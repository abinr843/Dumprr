"use client";

import React, { useRef, useState } from "react";
import { Maximize2, PictureInPicture2, Volume2, Gauge } from "lucide-react";

interface MediaPreviewProps {
  url: string;
  kind: "audio" | "video";
  fileName: string;
  mimeType?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Unified audio/video player with speed control, theater mode, PiP, fullscreen. */
export function MediaPreview({ url, kind, fileName, mimeType }: MediaPreviewProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [speed, setSpeed] = useState(1);
  const [theater, setTheater] = useState(false);

  const applySpeed = (s: number) => {
    setSpeed(s);
    if (mediaRef.current) mediaRef.current.playbackRate = s;
  };

  const handleFullscreen = () => {
    const el = mediaRef.current as unknown as HTMLElement | null;
    if (el && (el as HTMLVideoElement).requestFullscreen) {
      (el as HTMLVideoElement).requestFullscreen?.().catch(() => {});
    } else {
      window.open(url, "_blank");
    }
  };

  const handlePiP = async () => {
    try {
      const video = mediaRef.current as unknown as HTMLVideoElement | null;
      if (video && document.pictureInPictureEnabled && kind === "video") {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      }
    } catch {
      /* PiP unsupported */
    }
  };

  if (kind === "audio") {
    return (
      <div className="media-audio-card">
        <div className="audio-art">
          <Volume2 size={30} />
        </div>
        <div className="audio-main">
          <div className="audio-title" title={fileName}>{fileName}</div>
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={url}
            controls
            preload="metadata"
            className="audio-el"
          />
          <div className="media-tools">
            <span className="tool-label"><Gauge size={13} /> Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`speed-btn ${speed === s ? "active" : ""}`}
                onClick={() => applySpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
        <style jsx>{`
          .media-audio-card { display: flex; gap: 16px; align-items: center; padding: 28px; width: 100%; }
          .audio-art { width: 72px; height: 72px; border-radius: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #4c1d95, #2563eb); color: #fff; box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
          .audio-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
          .audio-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .audio-el { width: 100%; }
          .media-tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .tool-label { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); margin-right: 4px; }
          .speed-btn { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 9999px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; }
          .speed-btn.active { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.4); color: var(--color-primary); }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`media-video-wrap ${theater ? "theater" : ""}`}>
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        src={url}
        controls
        preload="metadata"
        playsInline
        className="video-el"
      >
        {mimeType ? <source src={url} type={mimeType} /> : null}
      </video>
      <div className="media-tools video-tools">
        <span className="tool-label"><Gauge size={13} /> Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`speed-btn ${speed === s ? "active" : ""}`}
            onClick={() => applySpeed(s)}
          >
            {s}×
          </button>
        ))}
        <span className="spacer" />
        <button type="button" className="v-btn" onClick={() => setTheater((t) => !t)} title="Theater mode">
          <Maximize2 size={14} /> Theater
        </button>
        <button type="button" className="v-btn" onClick={handlePiP} title="Picture in picture">
          <PictureInPicture2 size={14} /> PiP
        </button>
        <button type="button" className="v-btn" onClick={handleFullscreen} title="Fullscreen">
          <Maximize2 size={14} /> Full
        </button>
      </div>
      <style jsx>{`
        .media-video-wrap { display: flex; flex-direction: column; width: 100%; background: #000; }
        .video-el { width: 100%; max-height: 55vh; background: #000; }
        .theater .video-el { max-height: 72vh; }
        .media-video-wrap.theater { width: 100%; }
        .video-tools { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: var(--bg-card); border-top: 1px solid var(--border-subtle); flex-wrap: wrap; }
        .tool-label { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); margin-right: 4px; }
        .speed-btn { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 9999px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; }
        .speed-btn.active { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.4); color: var(--color-primary); }
        .spacer { flex: 1; }
        .v-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; }
        .v-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
      `}</style>
    </div>
  );
}
