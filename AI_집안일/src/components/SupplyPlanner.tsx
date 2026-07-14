import { useState, type FormEvent } from 'react';
import { todayKey } from '../domain/date';
import { supplyProjection } from '../domain/supplies';
import type { SupplyItem } from '../domain/types';

interface SupplyPlannerProps {
  items: SupplyItem[];
  onAdd: (item: Omit<SupplyItem, 'id' | 'updatedAt'>) => void;
  onPurchase: (itemId: string, purchaseDate: string, purchaseQuantity: number) => void;
  onRemove: (itemId: string) => void;
}

export function SupplyPlanner({ items, onAdd, onPurchase, onRemove }: SupplyPlannerProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', unit: '개', purchaseDate: todayKey(), purchaseQuantity: 1, weeklyUsage: 1, safetyStock: 0, reminderDaysBefore: 7 });

  function submit(event: FormEvent) {
    event.preventDefault();
    onAdd(form);
    setForm({ name: '', unit: '개', purchaseDate: todayKey(), purchaseQuantity: 1, weeklyUsage: 1, safetyStock: 0, reminderDaysBefore: 7 });
    setAdding(false);
  }

  return <section className="report-section supply-planner">
    <div className="section-heading"><h2>생활용품 관리</h2><span>앱이 기억해요</span></div>
    <p className="labor-intro">구매 기록과 사용량으로 소진 시점을 예상하고, 확인할 때가 되면 구매 업무를 보여드려요.</p>
    {!items.length ? <div className="report-empty">샴푸, 휴지, 세제처럼 미리 챙겨야 하는 품목을 등록해보세요.</div> : <ul>{items.map((item) => { const projection = supplyProjection(item); return <li key={item.id}><div><strong>{item.name}</strong><small>{item.purchaseDate}에 {item.purchaseQuantity}{item.unit} 구매 · 주 {item.weeklyUsage}{item.unit} 예상</small><span>확인 {projection.checkDate} · 예상 구매 {projection.expectedPurchaseDate}</span></div><div><button type="button" onClick={() => onPurchase(item.id, todayKey(), item.purchaseQuantity)}>오늘 재구매</button><button type="button" aria-label={`${item.name} 삭제`} onClick={() => onRemove(item.id)}>×</button></div></li>; })}</ul>}
    <button className="secondary-button labor-test-button" type="button" onClick={() => setAdding((value) => !value)}>{adding ? '등록 취소' : '＋ 생활용품 등록'}</button>
    {adding && <form className="supply-form" onSubmit={submit}><label>품목 이름<input required maxLength={20} placeholder="예: 두루마리 휴지" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div><label>구매일<input type="date" required value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} /></label><label>단위<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>개</option><option>롤</option><option>통</option><option>팩</option><option>ml</option></select></label></div><div><label>구매 수량<input type="number" min="0.1" step="0.1" required value={form.purchaseQuantity} onChange={(event) => setForm({ ...form, purchaseQuantity: Number(event.target.value) })} /></label><label>주간 사용량<input type="number" min="0.1" step="0.1" required value={form.weeklyUsage} onChange={(event) => setForm({ ...form, weeklyUsage: Number(event.target.value) })} /></label></div><div><label>안전 재고<input type="number" min="0" step="0.1" value={form.safetyStock} onChange={(event) => setForm({ ...form, safetyStock: Number(event.target.value) })} /></label><label>며칠 전 확인<input type="number" min="0" max="90" value={form.reminderDaysBefore} onChange={(event) => setForm({ ...form, reminderDaysBefore: Number(event.target.value) })} /></label></div><button className="primary-button" type="submit">등록하고 구매 업무 만들기</button></form>}
  </section>;
}
