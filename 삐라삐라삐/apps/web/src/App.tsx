import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from './lib/api';
import { isLocalPreview, purchaseSingleFlyer, resolveAnonymousUserKey, restorePendingPurchases } from './lib/platform';
import { ComposeScreen } from './components/ComposeScreen';
import { HomeScreen } from './components/HomeScreen';
import { HuntScreen } from './components/HuntScreen';
import { LettersScreen } from './components/LettersScreen';
import { ReaderScreen } from './components/ReaderScreen';
import { StoreScreen } from './components/StoreScreen';
import type { FoundFlyer, MoodTag, Region, UserFlyer, Wallet } from './types';

type Page = 'home' | 'compose' | 'letters' | 'hunt' | 'reader' | 'store';

export function App() {
  const [userKey, setUserKey] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [huntRegion, setHuntRegion] = useState<Region | null>(null);
  const [sentFlyers, setSentFlyers] = useState<UserFlyer[]>([]);
  const [foundFlyers, setFoundFlyers] = useState<FoundFlyer[]>([]);
  const [openedFlyer, setOpenedFlyer] = useState<FoundFlyer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const api = useMemo(() => (userKey ? new ApiClient(userKey) : null), [userKey]);
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3_200);
  }, []);

  const refresh = useCallback(async (client: ApiClient, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [nextRegions, nextSent, nextFound, nextWallet] = await Promise.all([
        client.getRegions(), client.getMyFlyers(), client.getFoundFlyers(), client.getWallet(),
      ]);
      setRegions(nextRegions); setSentFlyers(nextSent); setFoundFlyers(nextFound); setWallet(nextWallet);
      setSelectedRegionId((current) => current && nextRegions.some((region) => region.id === current)
        ? current : nextRegions.find((region) => region.inventoryCount > 0)?.id ?? nextRegions[0]?.id ?? null);
    } catch (error) { showToast(error instanceof Error ? error.message : '정보를 불러오지 못했어요.'); }
    finally { if (!silent) setLoading(false); }
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
        if (!cancelled) { setLoading(false); showToast(error instanceof Error ? error.message : '앱을 시작하지 못했어요.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [refresh, showToast]);

  useEffect(() => {
    if (!api || page !== 'home') return;
    const timer = window.setInterval(() => void refresh(api, true), 10_000);
    return () => window.clearInterval(timer);
  }, [api, page, refresh]);

  const submitFlyer = async (body: string, mood: MoodTag | null, regionId: string) => {
    if (!api) return;
    setSubmitting(true);
    try { await api.createFlyer(body, mood, regionId); await refresh(api, true); }
    catch (error) { showToast(error instanceof Error ? error.message : '삐라를 날리지 못했어요.'); throw error; }
    finally { setSubmitting(false); }
  };

  const buyFlyer = async () => {
    if (!api || !wallet) return;
    setBuying(true);
    try {
      if (isLocalPreview) await api.grantPurchase(`local-${crypto.randomUUID()}`, wallet.product.sku, true);
      else await purchaseSingleFlyer(wallet.product.sku, async (orderId) => { await api.grantPurchase(orderId, wallet.product.sku); return true; });
      await refresh(api, true);
      showToast('삐라 1장이 추가됐어요.');
    } catch (error) { showToast(error instanceof Error ? error.message : '결제를 완료하지 못했어요.'); }
    finally { setBuying(false); }
  };

  const restorePurchases = async () => {
    if (!api || !wallet) return;
    if (isLocalPreview) return showToast('로컬 체험에는 미결 주문이 없어요.');
    try {
      const restored = await restorePendingPurchases(wallet.product.sku, async (orderId) => { await api.grantPurchase(orderId, wallet.product.sku); return true; });
      await refresh(api, true);
      showToast(restored ? `미지급 이용권 ${restored}장을 복원했어요.` : '복원할 미결 주문이 없어요.');
    } catch (error) { showToast(error instanceof Error ? error.message : '구매 복원을 완료하지 못했어요.'); }
  };

  const report = async (flyerId: string, reason: string) => {
    if (!api) return;
    try { await api.reportFlyer(flyerId, reason); showToast('신고가 접수되어 삐라를 숨겼어요.'); await refresh(api, true); setPage('letters'); }
    catch (error) { showToast(error instanceof Error ? error.message : '신고를 접수하지 못했어요.'); }
  };

  if (!api && loading) return <div className="app-loading"><div className="loading-flyer">▧</div><p>바람에 날리는 마음을 불러오고 있어요</p></div>;

  return (
    <div className="app-shell">
      {page === 'home' && <HomeScreen regions={regions} selectedRegion={selectedRegion} wallet={wallet} loading={loading} onSelectRegion={(region) => setSelectedRegionId(region.id)} onStartHunt={(region) => { setHuntRegion(region); setPage('hunt'); }} onCompose={() => setPage('compose')} onOpenStore={() => setPage('store')} onRefresh={() => api && void refresh(api)} />}
      {page === 'compose' && <ComposeScreen regions={regions} wallet={wallet} submitting={submitting} onBack={() => setPage('home')} onNeedCredits={() => setPage('store')} onSubmit={submitFlyer} />}
      {page === 'letters' && <LettersScreen sentFlyers={sentFlyers} foundFlyers={foundFlyers} onOpenFound={(flyer) => { setOpenedFlyer(flyer); setPage('reader'); }} />}
      {page === 'hunt' && huntRegion && api && <HuntScreen region={huntRegion} api={api} onBack={() => setPage('home')} onClaimed={(flyer) => { setOpenedFlyer(flyer); setPage('reader'); void refresh(api, true); }} onError={showToast} />}
      {page === 'reader' && openedFlyer && <ReaderScreen flyer={openedFlyer} onBack={() => setPage('letters')} onReport={report} />}
      {page === 'store' && <StoreScreen wallet={wallet} buying={buying} localPreview={isLocalPreview} onBack={() => setPage('home')} onBuy={() => void buyFlyer()} onRestore={() => void restorePurchases()} />}

      {(page === 'home' || page === 'letters') && <nav className="bottom-nav">
        <button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z" /><path d="m4 8 8 6 8-6" /></svg><span>지역 탐색</span></button>
        <button className="bottom-nav__compose" onClick={() => setPage('compose')}><span>▧</span></button>
        <button className={page === 'letters' ? 'active' : ''} onClick={() => setPage('letters')}><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg><span>내 삐라</span></button>
      </nav>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
