import { toDateKey } from './date';
import type { SupplyItem } from './types';

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return toDateKey(value);
}

export function supplyProjection(item: SupplyItem) {
  const usableQuantity = Math.max(0, item.purchaseQuantity - item.safetyStock);
  const daysUntilSafetyStock = item.weeklyUsage > 0 ? Math.max(1, Math.round((usableQuantity / item.weeklyUsage) * 7)) : 365;
  const expectedPurchaseDate = addDays(item.purchaseDate, daysUntilSafetyStock);
  const checkDate = addDays(expectedPurchaseDate, -Math.max(0, item.reminderDaysBefore));
  return { daysUntilSafetyStock, expectedPurchaseDate, checkDate };
}
