"use client";

import React, { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";

interface ImageViewerProps {
  url: string;
  alt: string;
}

/** Zoomable (25–400%), pannable, rotatable image viewer with dimensions. */
export function ImageViewer({ url, alt }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPos({ x: 0, y: 0 });
    setDims(null);
  }, [url]);

  const zoomPct = Math.round(zoom * 100);

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
      y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
    });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="iv-wrap">
      <div className="iv-toolbar">
        <button type="button" className="iv-btn" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span className="iv-zoom">{zoomPct}%</span>
        <button type="button" className="iv-btn" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button type="button" className="iv-btn" onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate 90°">
          <RotateCw size={14} />
        </button>
        <button type="button" className="iv-btn" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); setRotation(0); }} title="Reset">
          <Maximize2 size={14} />
        </button>
        {dims && (
          <span className="iv-dims">{dims.w} × {dims.h}px</span>
        )}
        <span className="iv-hint">Drag to pan · Scroll to zoom</span>
      </div>
      <div
        className="iv-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onWheel={(e) => {
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          setZoom((z) => Math.min(4, Math.max(0.25, +(z + delta).toFixed(2))));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setDims({ w: el.naturalWidth, h: el.naturalHeight });
          }}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rotation}deg) scale(${zoom})`,
          }}
          className="iv-img"
        />
      </div>
      <style jsx>{`
        .iv-wrap { display: flex; flex-direction: column; width: 100%; }
        .iv-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-card); }
        .iv-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; }
        .iv-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .iv-zoom { font-size: 12px; font-weight: 700; color: var(--text-primary); min-width: 44px; text-align: center; }
        .iv-dims { font-size: 11px; color: var(--text-muted); }
        .iv-hint { margin-left: auto; font-size: 11px; color: var(--text-muted); }
        .iv-canvas { overflow: hidden; display: flex; align-items: center; justify-content: center; min-height: 320px; max-height: 62vh; background: repeating-conic-gradient(rgba(148,163,184,0.06) 0% 25%, transparent 0% 50%) 0 0 / 24px 24px, #0b0f1a; cursor: grab; }
        .iv-canvas:active { cursor: grabbing; }
        .iv-img { max-width: 90%; max-height: 58vh; object-fit: contain; border-radius: 6px; user-select: none; transition: transform 0.08s ease-out; }
      `}</style>
    </div>
  );
}
