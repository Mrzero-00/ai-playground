import type { PriceTick, TradeRecord } from '@trading/shared';
import type { TradingRepository } from '@trading/db';

export type OrderState = 'CREATED'|'VALIDATED'|'ENTRY_PENDING'|'EXPIRED'|'CANCELLED'|'ENTRY_FILLED'|'POSITION_OPEN'|'STOP_FILLED'|'TARGET1_FILLED'|'PARTIAL_OPEN'|'BREAKEVEN_STOP'|'TARGET2_FILLED'|'MANUAL_EXIT';
export type AuditEvent = { from: OrderState; to: OrderState; at: string; reason: string };
const transitions: Record<OrderState, readonly OrderState[]> = {
  CREATED:['VALIDATED','CANCELLED'], VALIDATED:['ENTRY_PENDING','CANCELLED'], ENTRY_PENDING:['EXPIRED','CANCELLED','ENTRY_FILLED'],
  ENTRY_FILLED:['POSITION_OPEN'], POSITION_OPEN:['STOP_FILLED','TARGET1_FILLED','MANUAL_EXIT'], TARGET1_FILLED:['PARTIAL_OPEN'],
  PARTIAL_OPEN:['BREAKEVEN_STOP','TARGET2_FILLED','MANUAL_EXIT'], EXPIRED:[], CANCELLED:[], STOP_FILLED:[], BREAKEVEN_STOP:[], TARGET2_FILLED:[], MANUAL_EXIT:[]
};
export class OrderStateMachine {
  readonly audit: AuditEvent[];
  constructor(public state: OrderState = 'CREATED', audit: AuditEvent[] = []) { this.audit = [...audit]; }
  transition(to: OrderState, reason: string, at = new Date().toISOString()) {
    if (!transitions[this.state].includes(to)) throw new Error(`Invalid order transition: ${this.state} -> ${to}`);
    this.audit.push({ from: this.state, to, at, reason }); this.state = to;
  }
  snapshot() { return JSON.stringify({ state: this.state, audit: this.audit }); }
  static restore(snapshot: string) { const value = JSON.parse(snapshot) as { state: OrderState; audit: AuditEvent[] }; return new OrderStateMachine(value.state, value.audit); }
}

export type PaperOrder = {
  symbol:string; strategyVersionId:string; signalAt:string; entryMin:number; entryMax:number;
  stopLoss:number; target1:number; target2:number; quantity:number; expiresAt:string;
  timeStopMinutes:number;
};
export type PaperPosition = { trade: TradeRecord; remainingQuantity:number; timeStopMinutes:number; state:OrderStateMachine };

export class PaperBrokerProvider {
  private readonly positions = new Map<string, PaperPosition>();
  constructor(private readonly repository: TradingRepository) {}
  async submit(order: PaperOrder, tick: PriceTick): Promise<PaperPosition> {
    const state = new OrderStateMachine(); state.transition('VALIDATED','paper_order_validated',tick.at); state.transition('ENTRY_PENDING','entry_order_ready',tick.at);
    if (tick.at > order.expiresAt) { state.transition('EXPIRED','entry_window_expired',tick.at); throw new Error('Paper order expired'); }
    if (tick.price < order.entryMin || tick.price > order.entryMax) throw new Error('Entry price is outside the planned range');
    state.transition('ENTRY_FILLED','paper_fill',tick.at); state.transition('POSITION_OPEN','protective_stop_active',tick.at);
    const trade: TradeRecord = { id:crypto.randomUUID(),strategyVersionId:order.strategyVersionId,symbol:order.symbol,strategyType:'dopamine',signalAt:order.signalAt,entryAt:tick.at,exitAt:null,plannedEntryMin:order.entryMin,plannedEntryMax:order.entryMax,actualEntryPrice:tick.price,actualExitPrice:null,quantity:order.quantity,stopLoss:order.stopLoss,target1:order.target1,target2:order.target2,pnlAmount:null,pnlPercent:null,exitReason:null };
    const position = { trade, remainingQuantity: order.quantity,timeStopMinutes:order.timeStopMinutes, state }; this.positions.set(order.symbol, position); await this.repository.saveTrade(trade); return position;
  }
  async onTick(tick: PriceTick,thesisValid=true): Promise<PaperPosition | null> {
    const p = this.positions.get(tick.symbol); if (!p) return null;
    if(!thesisValid&&(p.state.state==='POSITION_OPEN'||p.state.state==='PARTIAL_OPEN'))return this.close(p,tick,'MANUAL_EXIT','thesis_invalidated');
    const timeStopAt=Date.parse(p.trade.entryAt)+p.timeStopMinutes*60_000;
    if(Date.parse(tick.at)>=timeStopAt&&tick.price<=p.trade.actualEntryPrice&&p.state.state==='POSITION_OPEN')return this.close(p,tick,'MANUAL_EXIT','time_stop');
    if (p.state.state === 'POSITION_OPEN' && tick.price <= p.trade.stopLoss) return this.close(p,tick,'STOP_FILLED','stop');
    if (p.state.state === 'POSITION_OPEN' && tick.price >= p.trade.target1) {
      p.state.transition('TARGET1_FILLED','first_target_hit',tick.at); p.remainingQuantity = Math.ceil(p.remainingQuantity / 2); p.state.transition('PARTIAL_OPEN','stop_moved_to_breakeven',tick.at); await this.repository.saveTrade(p.trade); return p;
    }
    if (p.state.state === 'PARTIAL_OPEN' && tick.price <= p.trade.actualEntryPrice) return this.close(p,tick,'BREAKEVEN_STOP','stop');
    if (p.state.state === 'PARTIAL_OPEN' && tick.price >= p.trade.target2) return this.close(p,tick,'TARGET2_FILLED','target_2');
    return p;
  }
  private async close(p:PaperPosition,tick:PriceTick,state:'STOP_FILLED'|'BREAKEVEN_STOP'|'TARGET2_FILLED'|'MANUAL_EXIT',reason:'stop'|'target_2'|'time_stop'|'thesis_invalidated') {
    p.state.transition(state,reason,tick.at); p.trade.exitAt=tick.at; p.trade.actualExitPrice=tick.price; p.trade.exitReason=reason;
    p.trade.pnlAmount=(tick.price-p.trade.actualEntryPrice)*p.trade.quantity; p.trade.pnlPercent=((tick.price/p.trade.actualEntryPrice)-1)*100;
    this.positions.delete(tick.symbol); await this.repository.saveTrade(p.trade); return p;
  }
}
