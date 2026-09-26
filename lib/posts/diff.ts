/** Minimal line-based diff for version history (Feature 10). */

export type DiffRowType = "same" | "add" | "del";

export interface DiffRow {
  type: DiffRowType;
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

/** LCS-based line diff with a cap to keep it fast on large posts. */
export function diffLines(oldStr: string, newStr: string, maxLines = 2000): DiffRow[] {
  const a = (oldStr || "").split("\n").slice(0, maxLines);
  const b = (newStr || "").split("\n").slice(0, maxLines);
  const n = a.length;
  const m = b.length;
  // Cap DP table to 500x500; fall back to naive prefix/suffix diff beyond that
  if (n * m > 250000) {
    return naiveDiff(a, b);
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "same", text: a[i], oldNo: oldNo++, newNo: newNo++ });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "del", text: a[i], oldNo: oldNo++, newNo: null });
      i++;
    } else {
      rows.push({ type: "add", text: b[j], oldNo: null, newNo: newNo++ });
      j++;
    }
  }
  while (i < n) rows.push({ type: "del", text: a[i++], oldNo: oldNo++, newNo: null });
  while (j < m) rows.push({ type: "add", text: b[j++], oldNo: null, newNo: newNo++ });
  return rows;
}

function naiveDiff(a: string[], b: string[]): DiffRow[] {
  // common prefix
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  // common suffix
  let suf = 0;
  while (
    suf < a.length - pre &&
    suf < b.length - pre &&
    a[a.length - 1 - suf] === b[b.length - 1 - suf]
  ) {
    suf++;
  }
  const rows: DiffRow[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (let k = 0; k < pre; k++) rows.push({ type: "same", text: a[k], oldNo: oldNo++, newNo: newNo++ });
  for (let k = pre; k < a.length - suf; k++)
    rows.push({ type: "del", text: a[k], oldNo: oldNo++, newNo: null });
  for (let k = pre; k < b.length - suf; k++)
    rows.push({ type: "add", text: b[k], oldNo: null, newNo: newNo++ });
  for (let k = 0; k < suf; k++)
    rows.push({ type: "same", text: a[a.length - suf + k], oldNo: oldNo++, newNo: newNo++ });
  return rows;
}

/** Count added/removed lines — used for version list deltas. */
export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.type === "add") added++;
    if (r.type === "del") removed++;
  }
  return { added, removed };
}
