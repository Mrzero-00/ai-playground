import { FlyerIcon } from './FlyerIcon';
import type { Wallet } from '../types';

interface StoreScreenProps {
  wallet: Wallet | null;
  buying: boolean;
  localPreview: boolean;
  onBack: () => void;
  onBuy: () => void;
  onRestore: () => void;
}

export function StoreScreen({ wallet, buying, localPreview, onBack, onBuy, onRestore }: StoreScreenProps) {
  return (
    <main className="screen store-screen">
      <header className="top-bar"><button className="back-button" onClick={onBack}>‹</button><h1>삐라 이용권</h1><button className="text-button" onClick={onRestore}>구매 복원</button></header>
      <section className="store-hero">
        <FlyerIcon size={132} flying />
        <p className="eyebrow">매일 한 장은 무료</p>
        <h2>더 보내고 싶은 마음은<br />한 장씩 추가해요</h2>
        <p>무료 이용권은 매일 0시에 다시 생기고,<br />구매한 장수는 사용할 때까지 이월돼요.</p>
      </section>

      <section className="balance-card">
        <div><span>오늘 무료</span><strong>{wallet?.dailyFreeRemaining ?? 0}장</strong></div>
        <i />
        <div><span>구매 보유</span><strong>{wallet?.purchasedCredits ?? 0}장</strong></div>
      </section>

      <button className="product-card" onClick={onBuy} disabled={buying}>
        <span className="product-card__icon">P</span>
        <span><strong>삐라 1장</strong><small>선택한 시·구로 익명 편지 1회 발송</small></span>
        <b>{buying ? '처리 중…' : wallet?.product.displayPrice ?? '300원'}</b>
      </button>
      {localPreview && <p className="preview-notice">로컬 체험에서는 실제 결제 없이 이용권이 추가돼요.</p>}

      <section className="purchase-notes">
        <h3>구매 전 확인해 주세요</h3>
        <ul><li>앱인토스 소모성 인앱결제 상품이에요.</li><li>삐라를 날리는 순간 이용권 1장이 소진돼요.</li><li>환불·구매 내역은 토스앱의 인앱결제 화면에서 확인해요.</li></ul>
      </section>
      <button className="primary-button" onClick={onBuy} disabled={buying}>{buying ? '결제 확인 중…' : '300원으로 1장 추가'}</button>
    </main>
  );
}
