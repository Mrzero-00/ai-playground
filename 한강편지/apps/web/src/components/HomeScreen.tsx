import { BottleIcon } from './BottleIcon';
import { RiverMap } from './RiverMap';
import type { Park } from '../types';

interface HomeScreenProps {
  parks: Park[];
  selectedPark: Park | null;
  loading: boolean;
  onSelectPark: (park: Park) => void;
  onStartHunt: (park: Park) => void;
  onCompose: () => void;
  onRefresh: () => void;
}

export function HomeScreen({
  parks,
  selectedPark,
  loading,
  onSelectPark,
  onStartHunt,
  onCompose,
  onRefresh,
}: HomeScreenProps) {
  const total = parks.reduce((sum, park) => sum + park.inventoryCount, 0);

  return (
    <main className="screen home-screen">
      <header className="hero">
        <div>
          <p className="eyebrow">한강에서 온 편지</p>
          <h1>오늘 한강에<br /><strong>{total}통의 마음</strong>이 도착했어요</h1>
        </div>
        <BottleIcon size={84} />
      </header>

      <section className="map-card">
        <div className="section-heading">
          <div>
            <p>주변 편지 찾기</p>
            <h2>어느 공원으로 갈까요?</h2>
          </div>
          <button className="icon-button" onClick={onRefresh} aria-label="공원 재고 새로고침" disabled={loading}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 8.2A7 7 0 0 1 18.6 7M17.9 15.8A7 7 0 0 1 5.4 17" /></svg>
          </button>
        </div>
        {loading && parks.length === 0 ? (
          <div className="map-skeleton" aria-label="공원 정보를 불러오는 중" />
        ) : (
          <RiverMap parks={parks} selectedId={selectedPark?.id ?? null} onSelect={onSelectPark} />
        )}
      </section>

      {selectedPark ? (
        <section className="park-detail" style={{ '--park-accent': selectedPark.accent } as React.CSSProperties}>
          <div className="park-detail__top">
            <div className="park-count">{selectedPark.inventoryCount}</div>
            <div>
              <p>{selectedPark.name}</p>
              <h3>
                {selectedPark.inventoryCount > 0
                  ? `편지 ${selectedPark.inventoryCount}개가 떠내려왔어요`
                  : '아직 도착한 편지가 없어요'}
              </h3>
            </div>
          </div>
          <p className="muted">정확한 위치는 알려드리지 않아요. 공원을 천천히 걸으며 직접 발견해 보세요.</p>
          <button
            className="primary-button"
            disabled={selectedPark.inventoryCount === 0 || selectedPark.status !== 'ACTIVE'}
            onClick={() => onStartHunt(selectedPark)}
          >
            이 공원에서 찾아보기
          </button>
        </section>
      ) : (
        <section className="empty-selection">
          <span>지도에서 공원을 눌러 보세요</span>
        </section>
      )}

      <section className="send-card" onClick={onCompose} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onCompose()}>
        <div className="send-card__icon">✉</div>
        <div>
          <p>마음을 흘려보내고 싶다면</p>
          <h3>나도 편지 띄우기</h3>
        </div>
        <span aria-hidden="true">›</span>
      </section>

      <aside className="safety-note">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.3c0 4.7 3.2 8.4 7.5 9.7 4.3-1.3 7.5-5 7.5-9.7V6L12 3Z" /><path d="m8.7 12.2 2.1 2.1 4.6-4.8" /></svg>
        <div><strong>안전한 공원 영역에서만</strong><span>차도, 수변 난간, 공사 구역은 탐색 위치에서 제외했어요.</span></div>
      </aside>
    </main>
  );
}
