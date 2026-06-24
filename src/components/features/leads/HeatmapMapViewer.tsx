"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import type { HeatmapCell } from "@/lib/types/heatmap";
import { getRankStyle } from "@/lib/utils/heatmap-colors";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

interface HeatmapMapViewerProps {
  mapUrl: string;
  gridSize: number;
  gridCells: (HeatmapCell | null)[][];
}

export function HeatmapMapViewer({
  mapUrl,
  gridSize,
  gridCells,
}: HeatmapMapViewerProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const clampScale = (value: number) =>
    Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  const zoomIn = () => setScale((s) => clampScale(s + 0.35));
  const zoomOut = () => setScale((s) => clampScale(s - 0.35));
  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => clampScale(s + delta));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div className="flex-1 min-h-0 relative m-3 rounded-xl overflow-hidden border border-neutral-200 shadow-sm bg-neutral-200">
      <div
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden touch-none ${
          scale > 1 ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="absolute inset-0 origin-center transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapUrl}
            alt="Map"
            className="absolute inset-0 w-full h-full object-cover select-none"
            draggable={false}
          />

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%] z-20 pointer-events-none flex flex-col items-center">
            <MapPin
              size={30}
              className="text-blue-600 fill-blue-600 drop-shadow-lg"
            />
            <span className="bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow -mt-0.5">
              YOU
            </span>
          </div>

          <div
            className="absolute inset-0 grid p-5 sm:p-8 z-10"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            }}
          >
            {gridCells.flat().map((cell, i) => {
              if (!cell) return <div key={i} />;
              const style = getRankStyle(cell.rank);
              return (
                <div
                  key={`${cell.row}-${cell.col}`}
                  className="flex items-center justify-center"
                >
                  <div
                    className={`rounded-full flex items-center justify-center font-bold text-white shadow select-none ${
                      cell.isCenter
                        ? "w-10 h-10 sm:w-12 sm:h-12 text-sm ring-[3px] ring-blue-500 ring-offset-1"
                        : "w-7 h-7 sm:w-8 sm:h-8 text-[10px] sm:text-xs"
                    }`}
                    style={{ backgroundColor: style.backgroundColor }}
                    title={
                      cell.isCenter
                        ? `Your rank: ${style.label}`
                        : `Rank ${style.label}`
                    }
                  >
                    {style.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-1 bg-white/95 backdrop-blur rounded-xl shadow-md border border-neutral-200 p-1">
        <MapControlButton onClick={zoomIn} label="Zoom in">
          <Plus size={16} />
        </MapControlButton>
        <MapControlButton onClick={zoomOut} label="Zoom out" disabled={scale <= MIN_SCALE}>
          <Minus size={16} />
        </MapControlButton>
        <MapControlButton onClick={resetView} label="Reset view" disabled={scale === 1 && pan.x === 0 && pan.y === 0}>
          <RotateCcw size={14} />
        </MapControlButton>
      </div>

      <div className="absolute bottom-3 left-3 z-30 bg-white/90 backdrop-blur text-[10px] text-neutral-500 px-2 py-1 rounded-lg border border-neutral-200">
        Scroll to zoom · drag to pan
      </div>
    </div>
  );
}

function MapControlButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 transition"
    >
      {children}
    </button>
  );
}
