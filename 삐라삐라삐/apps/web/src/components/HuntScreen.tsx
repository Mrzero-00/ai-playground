import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../lib/api';
import { acquireCurrentLocation, captureStillPhoto } from '../lib/platform';
import type { AppLocation, FoundFlyer, Region } from '../types';
import { FlyerIcon } from './FlyerIcon';

interface HuntScreenProps {
  region: Region;
  api: ApiClient;
  onBack: () => void;
  onClaimed: (flyer: FoundFlyer) => void;
  onError: (message: string) => void;
}

export function HuntScreen({ region, api, onBack, onClaimed, onError }: HuntScreenProps) {
  const [phase, setPhase] = useState<'intro' | 'scanning' | 'detected'>('intro');
  const [huntId, setHuntId] = useState<string | null>(null);
  const [location, setLocation] = useState<AppLocation | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [message, setMessage] = useState('밝고 안전한 공공장소에 멈춰 주세요.');
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
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setCameraReady(true); }
    } catch { setCameraReady(false); }
  };
  useEffect(() => { if (phase === 'scanning' && !import.meta.env.DEV && !streamRef.current) void startLiveCamera(); }, [phase]);
  useEffect(() => () => stopCamera(), []);

  const beginHunt = async () => {
    setBusy(true);
    try {
      const hunt = await api.startHunt(region.id);
      setHuntId(hunt.huntId);
      setPhase('scanning');
      if (import.meta.env.DEV) setMessage('로컬에서는 아래 체험 위치로 전체 흐름을 확인할 수 있어요.');
      else {
        setMessage('천천히 걸으며 바람에 날리는 종이를 찾아보세요.');
        try { setLocation(await acquireCurrentLocation()); } catch (error) { setMessage(errorMessage(error)); }
      }
    } catch (error) { onError(errorMessage(error)); } finally { setBusy(false); }
  };

  const scan = async (simulate = false) => {
    if (!huntId) return;
    setBusy(true);
    try {
      let nextLocation = location;
      if (!simulate) { nextLocation = await acquireCurrentLocation(); setLocation(nextLocation); }
      const result = await api.scanHunt(huntId, nextLocation, simulate);
      if (result.detected && result.claimToken) {
        setClaimToken(result.claimToken); setPhase('detected'); setMessage('바람에 흩날리는 삐라를 발견했어요!'); navigator.vibrate?.(80);
      } else if (result.reason === 'LOCATION_ACCURACY_LOW') setMessage('위치 신호가 약해요. 잠시 멈춰서 다시 확인해 주세요.');
      else setMessage('이 근처에는 보이지 않아요. 안전한 길로 조금 더 걸어볼까요?');
    } catch (error) { onError(errorMessage(error)); } finally { setBusy(false); }
  };

  const claim = async () => {
    if (!huntId || !claimToken) return;
    setBusy(true);
    try {
      const result = await api.claimFlyer(huntId, claimToken, location?.accuracy ?? 999);
      stopCamera(); onClaimed(result.flyer);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FLYER_ALREADY_CLAIMED') {
        setPhase('scanning'); setClaimToken(null); setMessage('다른 사람이 먼저 발견했어요. 남은 삐라를 다시 찾아보세요.');
      } else onError(errorMessage(error));
    } finally { setBusy(false); }
  };

  const useStillPhoto = async () => {
    try { setPhoto(await captureStillPhoto()); setMessage('촬영한 장면 위에서 삐라를 찾아볼게요.'); }
    catch (error) { onError(errorMessage(error, '카메라 권한을 허용한 뒤 다시 시도해 주세요.')); }
  };

  if (phase === 'intro') return (
    <main className="screen hunt-intro ppira-hunt-intro">
      <header className="top-bar top-bar--overlay"><button className="back-button" onClick={onBack}>‹</button><h1>삐라 찾기</h1><span /></header>
      <div className="hunt-intro__visual"><div className="wind-radar"><i /><i /><i /><FlyerIcon size={92} flying /></div></div>
      <section className="hunt-intro__content"><p className="eyebrow">{region.displayName}</p><h2>{region.inventoryCount}장의 삐라가<br />어딘가에 내려앉아 있어요</h2>
        <ul><li><span>1</span>{region.district} 안에서만 탐색할 수 있어요.</li><li><span>2</span>정확한 좌표와 방향은 알려드리지 않아요.</li><li><span>3</span>화면보다 차량과 보행자를 먼저 확인해 주세요.</li></ul>
        <button className="primary-button" disabled={busy} onClick={() => void beginHunt()}>{busy ? '탐색을 준비하는 중…' : '안전한 곳에서 AR 탐색 시작'}</button>
      </section>
    </main>
  );

  return (
    <main className="camera-screen">
      <div className="camera-layer">
        {photo ? <img src={photo} alt="촬영한 지역 주변" /> : <video ref={videoRef} muted playsInline />}
        {!photo && !cameraReady && <div className="camera-fallback ppira-camera"><div className="building building--1" /><div className="building building--2" /><div className="park-path" /></div>}
        <div className="camera-shade" /><div className="scan-grid"><i /><i /><i /><i /></div>
        {phase === 'detected' && <div className="detected-bottle detected-flyer"><span className="spark spark--1">✦</span><span className="spark spark--2">✦</span><FlyerIcon size={190} flying /></div>}
      </div>
      <header className="camera-header"><button onClick={onBack}>×</button><div><strong>{region.displayName}</strong><span>남은 삐라 {region.inventoryCount}장</span></div><span className="camera-status"><i /> AR 탐색 중</span></header>
      <div className="safety-banner"><span>!</span>이동 중에는 화면을 보지 마세요</div>
      <section className={phase === 'detected' ? 'hunt-controls hunt-controls--detected' : 'hunt-controls'}>
        <div className="hunt-message"><span className={phase === 'detected' ? 'pulse-dot pulse-dot--success' : 'pulse-dot'} /><div><strong>{phase === 'detected' ? '삐라를 발견했어요' : '바람을 따라 탐색 중이에요'}</strong><p>{message}</p></div></div>
        {phase === 'detected' ? <button className="primary-button" disabled={busy} onClick={() => void claim()}>{busy ? '줍는 중…' : '삐라 주워서 읽기'}</button> : (
          <div className="hunt-actions"><button className="scan-button" disabled={busy} onClick={() => void scan(false)}><span>⌖</span>{busy ? '확인 중…' : '여기서 주변 확인'}</button>{!cameraReady && <button className="secondary-button" onClick={() => void useStillPhoto()}>카메라로 촬영</button>}{import.meta.env.DEV && <button className="demo-button" disabled={busy} onClick={() => void scan(true)}>로컬 체험 위치 사용</button>}</div>
        )}
      </section>
    </main>
  );
}

function errorMessage(error: unknown, fallback = '잠시 후 다시 시도해 주세요.') { return error instanceof Error ? error.message : fallback; }
