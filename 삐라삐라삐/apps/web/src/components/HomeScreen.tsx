import { useEffect, useMemo, useState } from 'react';
import { FlyerIcon } from './FlyerIcon';
import { RegionGrid } from './RegionGrid';
import type { Region, Wallet } from '../types';

interface HomeScreenProps {
  regions: Region[];
  selectedRegion: Region | null;
  wallet: Wallet | null;
  loading: boolean;
  onSelectRegion: (region: Region) => void;
  onStartHunt: (region: Region) => void;
  onCompose: () => void;
  onOpenStore: () => void;
  onRefresh: () => void;
}

export function HomeScreen({ regions, selectedRegion, wallet, loading, onSelectRegion, onStartHunt, onCompose, onOpenStore, onRefresh }: HomeScreenProps) {
  const cities = useMemo(() => [...new Set(regions.map((region) => region.city))], [regions]);
  const [city, setCity] = useState('');
  useEffect(() => {
    if (!city && cities[0]) setCity(selectedRegion?.city ?? cities[0]);
  }, [cities, city, selectedRegion]);
  const visibleRegions = regions.filter((region) => region.city === city);
  const total = regions.reduce((sum, region) => sum + region.inventoryCount, 0);

  const chooseCity = (nextCity: string) => {
    setCity(nextCity);
    const first = regions.find((region) => region.city === nextCity);
    if (first) onSelectRegion(first);
  };

  return (
    <main className="screen home-screen">
      <header className="ppira-hero">
        <div className="hero-copy">
          <p className="eyebrow">삐라삐라삐</p>
          <h1>오늘 전국에<br /><strong>{total}장의 마음</strong>이 내려앉았어요</h1>
          <p>낯선 누군가가 당신의 동네에 날린 익명 편지예요.</p>
        </div>
        <FlyerIcon size={112} flying />
        <i className="hero-confetti hero-confetti--one" /><i className="hero-confetti hero-confetti--two" />
      </header>

      <button className="wallet-banner" onClick={wallet?.availableTotal ? onCompose : onOpenStore}>
        <span className="wallet-banner__stamp">P</span>
        <span><small>내 삐라 이용권</small><strong>{wallet?.availableTotal ?? 0}장 사용 가능</strong></span>
        <b>{wallet?.dailyFreeRemaining ? '오늘 무료 1장' : '+ 300원에 추가'} ›</b>
      </button>

      <section className="region-card">
        <div className="section-heading">
          <div><p>지역별 삐라 보기</p><h2>어느 구에 내려앉았을까요?</h2></div>
          <button className="icon-button" onClick={onRefresh} aria-label="삐라 현황 새로고침" disabled={loading}>
            <svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5M6.1 8.2A7 7 0 0 1 18.6 7M17.9 15.8A7 7 0 0 1 5.4 17" /></svg>
          </button>
        </div>
        <div className="city-tabs">
          {cities.map((item) => <button key={item} className={item === city ? 'active' : ''} onClick={() => chooseCity(item)}>{shortCity(item)}</button>)}
        </div>
        {loading && regions.length === 0 ? <div className="region-skeleton" /> : <RegionGrid regions={visibleRegions} selectedId={selectedRegion?.id ?? null} onSelect={onSelectRegion} />}
      </section>

      {selectedRegion && (
        <section className="region-detail" style={{ '--region-accent': selectedRegion.accent } as React.CSSProperties}>
          <div className="region-detail__top">
            <span className="region-count">{selectedRegion.inventoryCount}</span>
            <div><p>{selectedRegion.displayName}</p><h3>{selectedRegion.inventoryCount > 0 ? `삐라 ${selectedRegion.inventoryCount}장이 떨어져 있어요` : '아직 내려앉은 삐라가 없어요'}</h3></div>
          </div>
          <p className="muted">정확한 좌표는 숨겨져 있어요. 밝고 안전한 공공장소를 걸으며 찾아보세요.</p>
          <button className="primary-button" disabled={selectedRegion.inventoryCount === 0 || selectedRegion.status !== 'ACTIVE'} onClick={() => onStartHunt(selectedRegion)}>
            {selectedRegion.district}에서 AR로 찾기
          </button>
        </section>
      )}

      <section className="send-card" onClick={onCompose} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onCompose()}>
        <div className="send-card__icon">▧</div><div><p>어느 동네에 마음을 보낼까요?</p><h3>나도 삐라 날리기</h3></div><span>›</span>
      </section>

      <aside className="safety-note"><span>✓</span><div><strong>공공장소에서만 발견해요</strong><small>차도·주거지·공사 구역은 낙하 지점에서 제외해요.</small></div></aside>
    </main>
  );
}

function shortCity(city: string) {
  return city.replace('특별시', '').replace('광역시', '');
}
