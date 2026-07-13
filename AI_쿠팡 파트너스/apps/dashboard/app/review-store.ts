import { create } from "zustand";
export type ReviewStatus = "REVIEW_REQUIRED" | "APPROVED" | "REJECTED";
export interface ReviewItem { id: string; productName: string; channel: string; complianceScore: number; status: ReviewStatus; rejectionReason: string | null; }
interface ReviewState { items: ReviewItem[]; approve(id: string): void; reject(id: string, reason: string): void; }
export const initialReviewItems: ReviewItem[] = [{ id: "fixture-content-1", productName: "휴대용 선풍기", channel: "BLOG", complianceScore: 98, status: "REVIEW_REQUIRED", rejectionReason: null }];
export const useReviewStore = create<ReviewState>((set) => ({
  items: initialReviewItems,
  approve: (id) => { set((state) => ({ items: state.items.map((item) => item.id === id && item.complianceScore >= 95 ? { ...item, status: "APPROVED", rejectionReason: null } : item) })); },
  reject: (id, reason) => { const trimmed = reason.trim(); if (trimmed.length === 0) return; set((state) => ({ items: state.items.map((item) => item.id === id ? { ...item, status: "REJECTED", rejectionReason: trimmed } : item) })); },
}));
