import { useState, type FormEvent } from 'react';
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
  const [form, setForm] = useState({ name: '', unit: '개', purchaseDate: todayKey(), purchaseQuantity: '1', weeklyUsage: '1', safetyStock: '0', reminderDaysBefore: '7' });

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
    <div className="section-heading"><h2>생활용품 관리</h2><span>앱이 기억해요</span></div>
    <p className="labor-intro">구매 기록과 사용량으로 소진 시점을 예상하고, 확인할 때가 되면 구매 업무를 보여드려요.</p>
    {!items.length ? <div className="report-empty">샴푸, 휴지, 세제처럼 미리 챙겨야 하는 품목을 등록해보세요.</div> : <ul>{items.map((item) => { const projection = supplyProjection(item); return <li key={item.id}><div><strong>{item.name}</strong><small>{item.purchaseDate}에 {item.purchaseQuantity}{item.unit} 구매 · 주 {item.weeklyUsage}{item.unit} 예상</small><span>확인 {projection.checkDate} · 예상 구매 {projection.expectedPurchaseDate}</span></div><div><button type="button" onClick={() => onPurchase(item.id, todayKey(), item.purchaseQuantity)}>오늘 재구매</button><button type="button" aria-label={`${item.name} 삭제`} onClick={() => onRemove(item.id)}>×</button></div></li>; })}</ul>}
    <button className="secondary-button labor-test-button" type="button" onClick={() => setAdding((value) => !value)}>{adding ? '등록 취소' : '＋ 생활용품 등록'}</button>
    {adding && <form className="supply-form" onSubmit={submit}><label>품목 이름<input required maxLength={20} placeholder="예: 두루마리 휴지" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div><label>구매일<input type="date" required value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} /></label><label>단위<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>개</option><option>롤</option><option>통</option><option>팩</option><option>ml</option></select></label></div><div><NumericInput label="구매 수량" min={1} required value={form.purchaseQuantity} onChange={(value) => setForm({ ...form, purchaseQuantity: value })} /><NumericInput label="주간 사용량" min={1} required value={form.weeklyUsage} onChange={(value) => setForm({ ...form, weeklyUsage: value })} /></div><div><NumericInput label="안전 재고" min={0} value={form.safetyStock} onChange={(value) => setForm({ ...form, safetyStock: value })} /><NumericInput label="며칠 전 확인" max={90} min={0} value={form.reminderDaysBefore} onChange={(value) => setForm({ ...form, reminderDaysBefore: value })} /></div><button className="primary-button" type="submit">등록하고 구매 업무 만들기</button></form>}
  </section>;
}

function NumericInput({ label, value, min, max, required, onChange }: { label: string; value: string; min: number; max?: number; required?: boolean; onChange: (value: string) => void }) {
  return <label>{label}<input inputMode="numeric" max={max} min={min} required={required} step="1" type="number" value={value} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value)} onBlur={(event) => { if (event.target.value === '' || Number(event.target.value) < min) onChange(String(min)); else if (max !== undefined && Number(event.target.value) > max) onChange(String(max)); }} /></label>;
}
