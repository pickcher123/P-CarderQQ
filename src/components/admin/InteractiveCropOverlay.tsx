'use client';

import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CropBox } from '@/lib/card-scanner-utils';

type DragMode =
  | 'move'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

interface InteractiveCropOverlayProps {
  boxes: CropBox[];
  selectedBoxId: string | null;
  onSelectBox: (id: string) => void;
  onChangeBoxes: (boxes: CropBox[]) => void;
  onCommitBoxes?: (boxes: CropBox[], changedBoxId: string) => void;
  onDeleteBox?: (id: string) => void;
  hideBoxBadges?: boolean;
  variant?: 'front' | 'back';
  badgeSuffix?: string;
}

const MIN_BOX_W = 4;
const MIN_BOX_H = 5;

const round1 = (v: number) => Math.round(v * 10) / 10;

export function InteractiveCropOverlay({
  boxes,
  selectedBoxId,
  onSelectBox,
  onChangeBoxes,
  onCommitBoxes,
  onDeleteBox,
  hideBoxBadges = false,
  variant = 'front',
  badgeSuffix = '',
}: InteractiveCropOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dragStateRef = useRef<{
    boxId: string;
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    startBox: CropBox;
    containerWidth: number;
    containerHeight: number;
    latestBoxes: CropBox[];
    hasMoved: boolean;
  } | null>(null);

  const startDrag = (
    e: React.PointerEvent,
    box: CropBox,
    mode: DragMode
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const container = overlayRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    onSelectBox(box.id);
    setDraggingId(box.id);

    dragStateRef.current = {
      boxId: box.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { ...box },
      containerWidth: rect.width,
      containerHeight: rect.height,
      latestBoxes: boxes,
      hasMoved: false,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state) return;

    e.stopPropagation();
    e.preventDefault();

    if (
      !state.hasMoved &&
      Math.hypot(e.clientX - state.startClientX, e.clientY - state.startClientY) < 1.5
    ) {
      return;
    }
    state.hasMoved = true;

    const dxPct = ((e.clientX - state.startClientX) / state.containerWidth) * 100;
    const dyPct = ((e.clientY - state.startClientY) / state.containerHeight) * 100;

    const orig = state.startBox;
    let nextX = orig.x;
    let nextY = orig.y;
    let nextW = orig.width;
    let nextH = orig.height;

    if (state.mode === 'move') {
      nextX = Math.max(0, Math.min(100 - orig.width, orig.x + dxPct));
      nextY = Math.max(0, Math.min(100 - orig.height, orig.y + dyPct));
    } else {
      const origRight = orig.x + orig.width;
      const origBottom = orig.y + orig.height;

      if (state.mode.includes('w')) {
        const clampedX = Math.max(0, Math.min(origRight - MIN_BOX_W, orig.x + dxPct));
        nextX = clampedX;
        nextW = origRight - clampedX;
      }
      if (state.mode.includes('e')) {
        const clampedRight = Math.max(orig.x + MIN_BOX_W, Math.min(100, origRight + dxPct));
        nextW = clampedRight - nextX;
      }
      if (state.mode.includes('n')) {
        const clampedY = Math.max(0, Math.min(origBottom - MIN_BOX_H, orig.y + dyPct));
        nextY = clampedY;
        nextH = origBottom - clampedY;
      }
      if (state.mode.includes('s')) {
        const clampedBottom = Math.max(orig.y + MIN_BOX_H, Math.min(100, origBottom + dyPct));
        nextH = clampedBottom - nextY;
      }
    }

    const updated = boxes.map((b) =>
      b.id === state.boxId
        ? {
            ...b,
            x: round1(nextX),
            y: round1(nextY),
            width: round1(nextW),
            height: round1(nextH),
          }
        : b
    );

    state.latestBoxes = updated;
    onChangeBoxes(updated);
  };

  const endDrag = (e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state) return;

    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }

    const committed = state.latestBoxes;
    const changedId = state.boxId;
    const didMove = state.hasMoved;
    dragStateRef.current = null;
    setDraggingId(null);

    if (didMove && onCommitBoxes) {
      onCommitBoxes(committed, changedId);
    }
  };

  const isFront = variant === 'front';

  const handles: Array<{ mode: DragMode; className: string; cursor: string }> = [
    { mode: 'nw', className: '-top-1.5 -left-1.5 w-3 h-3 rounded-full', cursor: 'cursor-nwse-resize' },
    { mode: 'ne', className: '-top-1.5 -right-1.5 w-3 h-3 rounded-full', cursor: 'cursor-nesw-resize' },
    { mode: 'sw', className: '-bottom-1.5 -left-1.5 w-3 h-3 rounded-full', cursor: 'cursor-nesw-resize' },
    { mode: 'se', className: '-bottom-1.5 -right-1.5 w-3 h-3 rounded-full', cursor: 'cursor-nwse-resize' },
    { mode: 'n', className: '-top-1 left-1/2 -translate-x-1/2 w-5 h-2 rounded-full', cursor: 'cursor-ns-resize' },
    { mode: 's', className: '-bottom-1 left-1/2 -translate-x-1/2 w-5 h-2 rounded-full', cursor: 'cursor-ns-resize' },
    { mode: 'w', className: 'top-1/2 -left-1 -translate-y-1/2 w-2 h-5 rounded-full', cursor: 'cursor-ew-resize' },
    { mode: 'e', className: 'top-1/2 -right-1 -translate-y-1/2 w-2 h-5 rounded-full', cursor: 'cursor-ew-resize' },
  ];

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none select-none touch-none"
    >
      {boxes.map((box, idx) => {
        const isSelected = box.id === selectedBoxId;
        const isDragging = box.id === draggingId;

        return (
          <div
            key={box.id}
            onPointerDown={(e) => startDrag(e, box, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
              transform: box.rotation !== 0 ? `rotate(${box.rotation}deg)` : undefined,
            }}
            className={`absolute pointer-events-auto rounded-md border-2 flex flex-col justify-between p-1 ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            } ${
              isSelected
                ? isFront
                  ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_16px_rgba(245,158,11,0.55)] z-30'
                  : 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_16px_rgba(6,182,212,0.55)] z-30'
                : isFront
                ? 'border-cyan-400/85 bg-cyan-500/10 hover:border-amber-300 z-10'
                : 'border-slate-300/80 bg-slate-500/10 hover:border-cyan-300 z-10'
            }`}
          >
            {/* 頂部編號與快捷刪除按鈕 */}
            <div className="flex items-center justify-between gap-1 pointer-events-none">
              {!hideBoxBadges ? (
                <span className="px-1.5 py-0.5 rounded bg-slate-950/85 text-white text-[10px] font-black font-mono leading-none">
                  #{idx + 1}
                  {badgeSuffix}
                </span>
              ) : (
                <span />
              )}

              {isSelected && onDeleteBox && boxes.length > 1 && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBox(box.id);
                  }}
                  title="刪除此裁切框"
                  className="pointer-events-auto p-0.5 rounded bg-rose-600/90 hover:bg-rose-500 text-white shadow-xs transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* 底部角度顯示 */}
            {box.rotation !== 0 && (
              <div className="text-[9px] font-mono text-white/95 bg-slate-950/75 rounded px-1 self-start pointer-events-none leading-tight">
                {box.rotation}°
              </div>
            )}

            {/* 選中狀態：8 方向拖曳縮放控制點 */}
            {isSelected &&
              handles.map((handle) => (
                <div
                  key={handle.mode}
                  onPointerDown={(e) => startDrag(e, box, handle.mode)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className={`absolute ${handle.className} ${handle.cursor} ${
                    isFront ? 'bg-amber-400 border-slate-950' : 'bg-cyan-400 border-slate-950'
                  } border shadow-sm z-40 pointer-events-auto`}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
