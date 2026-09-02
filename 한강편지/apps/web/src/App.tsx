import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from './lib/api';
import { resolveAnonymousUserKey } from './lib/platform';
import { ComposeScreen } from './components/ComposeScreen';
import { HomeScreen } from './components/HomeScreen';
import { HuntScreen } from './components/HuntScreen';
import { LettersScreen } from './components/LettersScreen';
import { ReaderScreen } from './components/ReaderScreen';
import type { FoundLetter, MoodTag, Park, UserLetter } from './types';

type Page = 'home' | 'compose' | 'letters' | 'hunt' | 'reader';

export function App() {
  const [userKey, setUserKey] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [huntPark, setHuntPark] = useState<Park | null>(null);
  const [sentLetters, setSentLetters] = useState<UserLetter[]>([]);
  const [foundLetters, setFoundLetters] = useState<FoundLetter[]>([]);
  const [openedLetter, setOpenedLetter] = useState<FoundLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const api = useMemo(() => (userKey ? new ApiClient(userKey) : null), [userKey]);
  const selectedPark = parks.find((park) => park.id === selectedParkId) ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3_200);
  }, []);

  const refresh = useCallback(async (client: ApiClient, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [nextParks, nextSent, nextFound] = await Promise.all([
        client.getParks(),
        client.getMyLetters(),
        client.getFoundLetters(),
      ]);
      setParks(nextParks);
      setSentLetters(nextSent);
      setFoundLetters(nextFound);
      setSelectedParkId((current) => {
        if (current && nextParks.some((park) => park.id === current)) return current;
        return nextParks.find((park) => park.inventoryCount > 0)?.id ?? nextParks[0]?.id ?? null;
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : '정보를 불러오지 못했어요.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const key = await resolveAnonymousUserKey();
        if (cancelled) return;
        const client = new ApiClient(key);
        await client.createSession();
        if (cancelled) return;
        setUserKey(key);
        await refresh(client);
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
          showToast(error instanceof Error ? error.message : '앱을 시작하지 못했어요.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [refresh, showToast]);

  useEffect(() => {
    if (!api || page !== 'home') return;
    const timer = window.setInterval(() => void refresh(api, true), 10_000);
    return () => window.clearInterval(timer);
  }, [api, page, refresh]);

  const submitLetter = async (body: string, mood: MoodTag | null) => {
    if (!api) return;
    setSubmitting(true);
    try {
      await api.createLetter(body, mood);
      await refresh(api, true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '편지를 띄우지 못했어요.');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const startHunt = (park: Park) => {
    setHuntPark(park);
    setPage('hunt');
  };

  const openFound = (letter: FoundLetter) => {
    setOpenedLetter(letter);
    setPage('reader');
  };

  const claimed = (letter: FoundLetter) => {
    setOpenedLetter(letter);
    setPage('reader');
    if (api) void refresh(api, true);
  };

  const report = async (letterId: string, reason: string) => {
    if (!api) return;
    try {
      await api.reportLetter(letterId, reason);
      showToast('신고가 접수되어 편지를 숨겼어요.');
      await refresh(api, true);
      setPage('letters');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '신고를 접수하지 못했어요.');
    }
  };

  if (!api && loading) {
    return <div className="app-loading"><div className="loading-bottle">✉</div><p>한강의 편지를 불러오고 있어요</p></div>;
  }

  return (
    <div className="app-shell">
      {page === 'home' && (
        <HomeScreen
          parks={parks}
          selectedPark={selectedPark}
          loading={loading}
          onSelectPark={(park) => setSelectedParkId(park.id)}
          onStartHunt={startHunt}
          onCompose={() => setPage('compose')}
          onRefresh={() => api && void refresh(api)}
        />
      )}
      {page === 'compose' && (
        <ComposeScreen submitting={submitting} onBack={() => setPage('home')} onSubmit={submitLetter} />
      )}
      {page === 'letters' && (
        <LettersScreen sentLetters={sentLetters} foundLetters={foundLetters} onOpenFound={openFound} />
      )}
      {page === 'hunt' && huntPark && api && (
        <HuntScreen park={huntPark} api={api} onBack={() => setPage('home')} onClaimed={claimed} onError={showToast} />
      )}
      {page === 'reader' && openedLetter && (
        <ReaderScreen letter={openedLetter} onBack={() => setPage('letters')} onReport={report} />
      )}

      {(page === 'home' || page === 'letters') && (
        <nav className="bottom-nav" aria-label="주요 메뉴">
          <button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}>
            <svg viewBox="0 0 24 24"><path d="M3 11.2 12 4l9 7.2V20H6a3 3 0 0 1-3-3v-5.8Z" /><path d="M9 20v-6h6v6" /></svg><span>한강 지도</span>
          </button>
          <button className="bottom-nav__compose" onClick={() => setPage('compose')} aria-label="편지 띄우기"><span>✉</span></button>
          <button className={page === 'letters' ? 'active' : ''} onClick={() => setPage('letters')}>
            <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg><span>내 편지</span>
          </button>
        </nav>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
