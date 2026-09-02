import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../lib/api';
import { acquireCurrentLocation, captureStillPhoto } from '../lib/platform';
import type { AppLocation, FoundLetter, Park } from '../types';
import { BottleIcon } from './BottleIcon';

interface HuntScreenProps {
  park: Park;
  api: ApiClient;
  onBack: () => void;
  onClaimed: (letter: FoundLetter) => void;
  onError: (message: string) => void;
}

export function HuntScreen({ park, api, onBack, onClaimed, onError }: HuntScreenProps) {
  const [phase, setPhase] = useState<'intro' | 'scanning' | 'detected'>('intro');
  const [huntId, setHuntId] = useState<string | null>(null);
  const [location, setLocation] = useState<AppLocation | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [message, setMessage] = useState('공원 안의 안전한 곳에 멈춰 주세요.');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startLiveCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraReady(false);
    }
  };

  useEffect(() => {
    if (phase === 'scanning' && !import.meta.env.DEV && !streamRef.current) void startLiveCamera();
  }, [phase]);

  useEffect(() => () => stopCamera(), []);

  const beginHunt = async () => {
    setBusy(true);
    try {
      const hunt = await api.startHunt(park.id);
      setHuntId(hunt.huntId);
      setPhase('scanning');
      if (import.meta.env.DEV) {
        setMessage('로컬에서는 아래 체험 위치 버튼으로 전체 흐름을 확인할 수 있어요.');
      } else {
        setMessage('천천히 걸으며 주변을 둘러보세요.');
        try {
          setLocation(await acquireCurrentLocation());
        } catch (error) {
          setMessage(error instanceof Error ? error.message : '위치를 확인하지 못했어요.');
        }
      }
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const scan = async (simulate = false) => {
    if (!huntId) return;
    setBusy(true);
    try {
      let nextLocation = location;
      if (!simulate) {
        nextLocation = await acquireCurrentLocation();
        setLocation(nextLocation);
      }
      const result = await api.scanHunt(huntId, nextLocation, simulate);
      if (result.detected && result.claimToken) {
        setClaimToken(result.claimToken);
        setPhase('detected');
        setMessage('병 속에서 편지를 발견했어요!');
        navigator.vibrate?.(80);
      } else if (result.reason === 'LOCATION_ACCURACY_LOW') {
        setMessage('위치 신호가 약해요. 잠시 멈춰서 다시 확인해 주세요.');
      } else {
        setMessage('이 근처에는 보이지 않아요. 조금 더 걸어볼까요?');
      }
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!huntId || !claimToken) return;
    setBusy(true);
    try {
      const result = await api.claimLetter(huntId, claimToken, location?.accuracy ?? 999);
      stopCamera();
      onClaimed(result.letter);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'LETTER_ALREADY_CLAIMED') {
        setPhase('scanning');
        setClaimToken(null);
        setMessage('조금 전 다른 사람이 먼저 발견했어요. 남은 편지를 다시 찾아보세요.');
      } else {
        onError(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const useStillPhoto = async () => {
    try {
      setPhoto(await captureStillPhoto());
      setMessage('촬영한 장면 위에서 병을 찾아볼게요.');
    } catch (error) {
      onError(errorMessage(error, '카메라 권한을 허용한 뒤 다시 시도해 주세요.'));
    }
  };

  if (phase === 'intro') {
    return (
      <main className="screen hunt-intro">
        <header className="top-bar top-bar--overlay">
          <button className="back-button" onClick={onBack} aria-label="뒤로 가기">‹</button>
          <h1>편지 찾기</h1><span />
        </header>
        <div className="hunt-intro__visual">
          <div className="radar"><i /><i /><i /><span>✉</span></div>
        </div>
        <section className="hunt-intro__content">
          <p className="eyebrow">{park.name}</p>
          <h2>{park.inventoryCount}개의 편지가<br />어딘가에 머물러 있어요</h2>
          <ul>
            <li><span>1</span> 공원 안에서만 탐색할 수 있어요.</li>
            <li><span>2</span> 정확한 좌표와 방향은 알려드리지 않아요.</li>
            <li><span>3</span> 걸을 때는 화면보다 주변을 먼저 확인해 주세요.</li>
          </ul>
          <button className="primary-button" disabled={busy} onClick={() => void beginHunt()}>
            {busy ? '탐색을 준비하는 중…' : '안전한 곳에서 탐색 시작'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="camera-screen">
      <div className="camera-layer">
        {photo ? <img src={photo} alt="촬영한 공원 주변" /> : <video ref={videoRef} muted playsInline />}
        {!photo && !cameraReady && <div className="camera-fallback"><div className="tree tree--1" /><div className="tree tree--2" /><div className="river-shape" /></div>}
        <div className="camera-shade" />
        <div className="scan-grid" aria-hidden="true"><i /><i /><i /><i /></div>
        {phase === 'detected' && (
          <div className="detected-bottle"><span className="spark spark--1">✦</span><span className="spark spark--2">✦</span><BottleIcon size={164} glowing /></div>
        )}
      </div>

      <header className="camera-header">
        <button onClick={onBack} aria-label="탐색 종료">×</button>
        <div><strong>{park.name}</strong><span>남은 편지 {park.inventoryCount}개</span></div>
        <span className="camera-status"><i /> 탐색 중</span>
      </header>

      <div className="safety-banner"><span>!</span> 이동 중에는 화면을 보지 마세요</div>

      <section className={phase === 'detected' ? 'hunt-controls hunt-controls--detected' : 'hunt-controls'}>
        <div className="hunt-message">
          <span className={phase === 'detected' ? 'pulse-dot pulse-dot--success' : 'pulse-dot'} />
          <div><strong>{phase === 'detected' ? '편지를 발견했어요' : '주변을 탐색하고 있어요'}</strong><p>{message}</p></div>
        </div>
        {phase === 'detected' ? (
          <button className="primary-button" disabled={busy} onClick={() => void claim()}>{busy ? '병을 여는 중…' : '병을 주워 편지 열기'}</button>
        ) : (
          <div className="hunt-actions">
            <button className="scan-button" disabled={busy} onClick={() => void scan(false)}><span>⌖</span>{busy ? '확인 중…' : '여기서 주변 확인'}</button>
            {!cameraReady && <button className="secondary-button" onClick={() => void useStillPhoto()}>카메라로 촬영</button>}
            {import.meta.env.DEV && <button className="demo-button" disabled={busy} onClick={() => void scan(true)}>로컬 체험 위치 사용</button>}
          </div>
        )}
      </section>
    </main>
  );
}

function errorMessage(error: unknown, fallback = '잠시 후 다시 시도해 주세요.') {
  return error instanceof Error ? error.message : fallback;
}
