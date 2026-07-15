import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { todayKey } from '../domain/date';
import { supplyProjection } from '../domain/supplies';
import type { SupplyItem } from '../domain/types';

interface SupplyPlannerProps {
  items: SupplyItem[];
  onAdd: (item: Omit<SupplyItem, 'id' | 'updatedAt'>) => void;
  onPurchase: (itemId: string, purchaseDate: string, purchaseQuantity: number) => void;
  onRemove: (itemId: string) => void;
  compact?: boolean;
  onOpen?: () => void;
}

export function SupplyPlanner({ items, onAdd, onPurchase, onRemove, compact = false, onOpen }: SupplyPlannerProps) {
  const [adding, setAdding] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? '');
  const [purchaseAmount, setPurchaseAmount] = useState('1');
  const [form, setForm] = useState({ name: '', unit: '개', purchaseDate: todayKey(), purchaseQuantity: '1', weeklyUsage: '1', safetyStock: '0', reminderDaysBefore: '7' });

  useEffect(() => {
    if (!items.length) setSelectedItemId('');
    else if (!items.some((item) => item.id === selectedItemId)) setSelectedItemId(items[0].id);
  }, [items, selectedItemId]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];
  const dashboard = useMemo(() => {
    if (!selectedItem) return null;
    const projection = supplyProjection(selectedItem);
    const elapsedDays = Math.max(0, Math.floor((new Date(`${todayKey()}T12:00:00`).getTime() - new Date(`${selectedItem.purchaseDate}T12:00:00`).getTime()) / 86_400_000));
    const used = (selectedItem.weeklyUsage / 7) * elapsedDays;
    const remaining = Math.max(0, Math.round(selectedItem.purchaseQuantity - used));
    const usableDays = selectedItem.weeklyUsage > 0 ? Math.max(0, Math.round(((remaining - selectedItem.safetyStock) / selectedItem.weeklyUsage) * 7)) : 365;
    return { projection, remaining, usableDays, lowStock: remaining <= selectedItem.safetyStock };
  }, [selectedItem]);

  useEffect(() => {
    if (selectedItem) setPurchaseAmount(String(selectedItem.purchaseQuantity));
  }, [selectedItem]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onAdd({
      ...form,
      purchaseQuantity: Math.max(1, Number(form.purchaseQuantity)),
      weeklyUsage: Math.max(1, Number(form.weeklyUsage)),
      safetyStock: Math.max(0, Number(form.safetyStock || 0)),
      reminderDaysBefore: Math.min(90, Math.max(0, Number(form.reminderDaysBefore || 0))),
    });
    setForm({ name: '', unit: '개', purchaseDate: todayKey(), purchaseQuantity: '1', weeklyUsage: '1', safetyStock: '0', reminderDaysBefore: '7' });
    setAdding(false);
  }

  if (compact) return <button className="report-link-card" type="button" onClick={onOpen}><span aria-hidden="true">🧴</span><div><strong>생활용품 관리</strong><small>{items.length ? `${items.length}개 품목의 구매 시점을 관리 중이에요` : '자주 사는 생활용품을 미리 챙겨요'}</small></div><i aria-hidden="true">›</i></button>;

  return <section className="supply-planner detail-section">
    <div className="section-heading supply-heading"><div><h2>생활용품 관리</h2><p>사용 속도에 맞춰 다음 구매 시기를 알려드려요.</p></div><span>앱이 기억해요</span></div>
    {!items.length ? <div className="report-empty">샴푸, 휴지, 세제처럼 미리 챙겨야 하는 품목을 등록해보세요.</div> : <>
      <div className="supply-item-tabs" aria-label="관리할 생활용품 선택">{items.map((item) => <button aria-pressed={selectedItem?.id === item.id} className={selectedItem?.id === item.id ? 'is-active' : ''} key={item.id} onClick={() => setSelectedItemId(item.id)} type="button"><span aria-hidden="true">{item.unit === '롤' ? '🧻' : '🧴'}</span><strong>{item.name}</strong></button>)}</div>
      {selectedItem && dashboard && <div className="supply-dashboard">
        <article className="supply-hero-card"><span className="supply-product-icon" aria-hidden="true">{selectedItem.unit === '롤' ? '🧻' : '🧴'}</span><div><span className={`supply-status ${dashboard.lowStock ? 'is-low' : ''}`}>{dashboard.lowStock ? '구매 필요' : '정상'}</span><h3>{selectedItem.name}</h3><small>최근 구매 {selectedItem.purchaseDate}</small></div><div className="supply-current-stock"><span>현재 예상 보유량</span><strong>{dashboard.remaining}<small>{selectedItem.unit}</small></strong></div></article>
        <div className="supply-metric-grid">
          <article className="supply-usage-card"><span>주간 평균 사용량</span><strong>{selectedItem.weeklyUsage}<small>{selectedItem.unit}</small></strong><div className="supply-usage-chart" aria-label={`주간 평균 ${selectedItem.weeklyUsage}${selectedItem.unit}`}><i style={{ height: '52%' }} /><i style={{ height: '68%' }} /><i style={{ height: '68%' }} /><i style={{ height: '82%' }} /></div><div className="supply-chart-labels" aria-hidden="true"><span>4주 전</span><span>3주 전</span><span>2주 전</span><span>지난주</span></div><p>등록한 평균 사용량을 기준으로 표시해요.</p></article>
          <article><span>안전재고</span><strong>{selectedItem.safetyStock}<small>{selectedItem.unit}</small></strong><p>이하로 떨어지기 전 알림</p></article>
          <article><span>예상 사용 가능 기간</span><strong>{dashboard.usableDays}<small>일</small></strong><p>현재 속도로 사용 시</p></article>
          <article><span>다음 구매 예정일</span><strong className="is-date">{formatDate(dashboard.projection.expectedPurchaseDate)}</strong><p>확인일 {formatDate(dashboard.projection.checkDate)}</p></article>
        </div>
        <div className={`supply-alert-card ${dashboard.lowStock ? 'is-low' : ''}`}><span aria-hidden="true">🔔</span><div><strong>{dashboard.lowStock ? '안전재고에 도달했어요' : '구매 시기를 미리 알려드릴게요'}</strong><p>{dashboard.lowStock ? '구매 후 실제 수량을 입력해주세요.' : `${formatDate(dashboard.projection.checkDate)}부터 구매 업무에 표시해요.`}</p></div></div>
        <form className="supply-purchase-panel" onSubmit={(event) => { event.preventDefault(); onPurchase(selectedItem.id, todayKey(), Math.max(1, Number(purchaseAmount))); }}><div><span>구매한 수량을 입력해주세요</span><small>입력한 수량으로 다음 구매일을 다시 계산해요.</small></div><label><button aria-label="구매 수량 줄이기" onClick={() => setPurchaseAmount(String(Math.max(1, Number(purchaseAmount) - 1)))} type="button">−</button><input aria-label="구매 수량" inputMode="numeric" min="1" onChange={(event) => setPurchaseAmount(event.target.value)} onFocus={(event) => event.currentTarget.select()} step="1" type="number" value={purchaseAmount} /><strong>{selectedItem.unit}</strong><button aria-label="구매 수량 늘리기" onClick={() => setPurchaseAmount(String(Math.max(1, Number(purchaseAmount) + 1)))} type="button">＋</button></label><button className="primary-button" type="submit">입력 완료</button></form>
        <button className="supply-remove-button" onClick={() => onRemove(selectedItem.id)} type="button">이 품목 삭제</button>
      </div>}
    </>}
    <button className="secondary-button labor-test-button" type="button" onClick={() => setAdding((value) => !value)}>{adding ? '등록 취소' : '＋ 생활용품 등록'}</button>
    {adding && <form className="supply-form" onSubmit={submit}><label>품목 이름<input required maxLength={20} placeholder="예: 두루마리 휴지" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div><label>구매일<input type="date" required value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} /></label><label>단위<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>개</option><option>롤</option><option>통</option><option>팩</option><option>ml</option></select></label></div><div><NumericInput label="구매 수량" min={1} required value={form.purchaseQuantity} onChange={(value) => setForm({ ...form, purchaseQuantity: value })} /><NumericInput label="주간 사용량" min={1} required value={form.weeklyUsage} onChange={(value) => setForm({ ...form, weeklyUsage: value })} /></div><div><NumericInput label="안전 재고" min={0} value={form.safetyStock} onChange={(value) => setForm({ ...form, safetyStock: value })} /><NumericInput label="며칠 전 확인" max={90} min={0} value={form.reminderDaysBefore} onChange={(value) => setForm({ ...form, reminderDaysBefore: value })} /></div><button className="primary-button" type="submit">등록하고 구매 업무 만들기</button></form>}
  </section>;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function NumericInput({ label, value, min, max, required, onChange }: { label: string; value: string; min: number; max?: number; required?: boolean; onChange: (value: string) => void }) {
  return <label>{label}<input inputMode="numeric" max={max} min={min} required={required} step="1" type="number" value={value} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value)} onBlur={(event) => { if (event.target.value === '' || Number(event.target.value) < min) onChange(String(min)); else if (max !== undefined && Number(event.target.value) > max) onChange(String(max)); }} /></label>;
}
