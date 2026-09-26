"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, History, Loader2, RotateCcw, ChevronDown } from "lucide-react";
import { diffLines, diffStats } from "@/lib/posts/diff";
import { apiFetch } from "@/lib/client/api";
import { toast } from "@/components/ui/Toast";
import type { PostVersionRecord } from "@/types/posts";

interface PostHistoryModalProps {
  postId: string;
  currentContent?: string | null;
  onClose: () => void;
  onRestored: () => void;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Version history with unified diff + one-click rollback (Feature 10). */
export function PostHistoryModal({ postId, onClose, onRestored }: PostHistoryModalProps) {
  const [versions, setVersions] = useState<PostVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/versions`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load history");
        return d;
      })
      .then((d) => {
        setVersions(d.versions || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed");
        setLoading(false);
      });
  }, [postId]);

  const handleRestore = async (versionId: string) => {
    if (!confirm("Restore this revision? Current content will be snapshotted first.")) return;
    setRestoring(versionId);
    try {
      await toast.promise(
        apiFetch(`/api/posts/${postId}/versions/${versionId}/restore`, { method: "POST" }),
        {
          loading: "Restoring revision…",
          success: "Revision restored",
          error: (e) => (e instanceof Error ? e.message : "Couldn't restore revision"),
        }
      );
      onRestored();
    } catch {
      // toast.promise already surfaced the error
    } finally {
      setRestoring(null);
    }
  };

  return (
    <>
      <div className="hist-backdrop" onClick={onClose} />
      <div className="hist-modal" role="dialog" aria-label="Version history">
        <div className="hist-head">
          <History size={17} />
          <h3>Version History</h3>
          <button type="button" className="hist-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="hist-body">
          {loading ? (
            <div className="hist-state"><Loader2 size={20} className="spin" /> Loading revisions…</div>
          ) : error ? (
            <div className="hist-state">{error}</div>
          ) : versions.length === 0 ? (
            <div className="hist-state">No revisions yet — edits will be snapshotted here automatically.</div>
          ) : (
            versions.map((v) => (
              <VersionRow
                key={v.id}
                version={v}
                expanded={expanded === v.id}
                onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                onRestore={() => handleRestore(v.id)}
                restoring={restoring === v.id}
              />
            ))
          )}
        </div>
      </div>
      <style jsx>{`
        .hist-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1200; }
        .hist-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: min(92vw, 720px); max-height: 84vh; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 14px; z-index: 1201; display: flex; flex-direction: column; overflow: hidden; }
        .hist-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); }
        .hist-head h3 { margin: 0; font-size: 15px; flex: 1; }
        .hist-x { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 5px; border-radius: 6px; display: flex; }
        .hist-x:hover { background: var(--bg-hover); color: var(--text-primary); }
        .hist-body { overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
        .hist-state { padding: 36px; text-align: center; color: var(--text-muted); font-size: 13px; display: flex; gap: 8px; align-items: center; justify-content: center; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

function VersionRow({
  version,
  expanded,
  onToggle,
  onRestore,
  restoring,
}: {
  version: PostVersionRecord;
  expanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
  restoring: boolean;
}) {
  const rows = useMemo(
    () => diffLines(version.content || "", ""),
    // Diff target (current) unknown here; show snapshot preview instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version.id]
  );
  const stats = diffStats(rows);
  void stats;
  const words = (version.content || "").trim() ? (version.content || "").trim().split(/\s+/).length : 0;
  return (
    <div className="v-row">
      <button type="button" className="v-main" onClick={onToggle}>
        <span className="v-badge">v{version.version_number}</span>
        <span className="v-info">
          <span className="v-title">{version.title}</span>
          <span className="v-meta">
            {new Date(version.created_at).toLocaleString()} · {words} words
            {version.change_summary ? ` · ${version.change_summary}` : ""}
          </span>
        </span>
        <ChevronDown size={15} className={`v-chev ${expanded ? "open" : ""}`} />
      </button>
      {expanded && (
        <div className="v-detail">
          <DiffAgainstCurrent version={version} />
          <button type="button" className="v-restore" onClick={onRestore} disabled={restoring}>
            <RotateCcw size={13} /> {restoring ? "Restoring…" : `Restore v${version.version_number}`}
          </button>
        </div>
      )}
      <style jsx>{`
        .v-row { border: 1px solid var(--border-subtle); border-radius: 10px; overflow: hidden; background: var(--bg-card); }
        .v-main { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: transparent; border: none; cursor: pointer; color: var(--text-primary); text-align: left; }
        .v-badge { font-size: 11px; font-weight: 800; background: rgba(99,102,241,0.14); color: var(--color-primary); padding: 3px 8px; border-radius: 9999px; white-space: nowrap; }
        .v-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .v-title { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .v-meta { font-size: 11px; color: var(--text-muted); }
        .v-chev { transition: transform 0.12s; color: var(--text-muted); }
        .v-chev.open { transform: rotate(180deg); }
        .v-detail { border-top: 1px solid var(--border-subtle); padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
        .v-restore { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 7px; border: 1px solid rgba(16,185,129,0.4); background: rgba(16,185,129,0.1); color: #10b981; cursor: pointer; }
        .v-restore:disabled { opacity: 0.6; }
      `}</style>
    </div>
  );
}

function DiffAgainstCurrent({ version }: { version: PostVersionRecord }) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/posts/${version.post_id}`)
      .then((r) => r.json())
      .then((d) => setCurrent(d.post?.content || ""))
      .catch(() => setCurrent(""));
  }, [version.post_id]);
  const rows = useMemo(
    () => (current == null ? [] : diffLines(version.content || "", current)),
    [version.content, current]
  );
  const stats = diffStats(rows);
  if (current == null) return <div className="d-state">Computing diff…</div>;
  const visible = rows.filter((r) => r.type !== "same" || false);
  const context: typeof rows = [];
  // include 2 lines of context around changes
  rows.forEach((r, i) => {
    if (r.type !== "same") {
      for (let k = Math.max(0, i - 2); k <= Math.min(rows.length - 1, i + 2); k++) {
        if (!context.includes(rows[k])) context.push(rows[k]);
      }
    }
  });
  const show = context.length > 0 ? context : rows.slice(0, 40);
  return (
    <div className="diff">
      <div className="diff-stats"><span className="add">+{stats.added}</span> <span className="del">−{stats.removed}</span> vs current</div>
      <pre className="diff-pre">
        {show.map((r, i) => (
          <span key={i} className={`dl dl-${r.type}`}>
            <span className="dl-gutter">{r.type === "add" ? "+" : r.type === "del" ? "−" : " "}</span>
            <span dangerouslySetInnerHTML={{ __html: esc(r.text) || " " }} />
          </span>
        ))}
        {visible.length === 0 && <span className="dl dl-same">No differences vs current.</span>}
      </pre>
      <style jsx>{`
        .d-state { font-size: 12px; color: var(--text-muted); }
        .diff-stats { font-size: 11px; color: var(--text-muted); display: flex; gap: 8px; }
        .add { color: #34d399; font-weight: 700; } .del { color: #f87171; font-weight: 700; }
        .diff-pre { margin: 0; background: #0b0f1a; border-radius: 8px; padding: 10px 0; font-size: 12px; font-family: monospace; line-height: 1.6; max-height: 260px; overflow: auto; color: #dbe2f1; }
        .dl { display: flex; gap: 8px; padding: 0 12px; }
        .dl-add { background: rgba(52,211,153,0.1); } .dl-del { background: rgba(248,113,113,0.1); }
        .dl-gutter { width: 12px; color: #64748b; user-select: none; }
      `}</style>
    </div>
  );
}
