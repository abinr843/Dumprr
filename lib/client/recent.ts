"use client";

/** Recently-viewed tray backed by localStorage (Feature 8). */

export interface RecentItem {
  id: string;
  type: "file" | "post";
  title: string;
  extension?: string | null;
  viewedAt: string;
}

const KEY = "dumpr_recent_items";
const MAX = 20;

export function getRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentItem[];
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentItem(item: Omit<RecentItem, "viewedAt">): RecentItem[] {
  try {
    const prev = getRecentItems().filter(
      (r) => !(r.id === item.id && r.type === item.type)
    );
    const next: RecentItem[] = [
      { ...item, viewedAt: new Date().toISOString() },
      ...prev,
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function clearRecentItems(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
