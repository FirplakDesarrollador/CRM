"use client";

import React, { useState, useEffect, useCallback, useRef, type DragEvent } from "react";
import { GripVertical } from "lucide-react";

export interface TileDef {
  id: string;
  label: string;
  colSpan: number; // out of 12
}

export const DEFAULT_TILES: TileDef[] = [
  { id: "sales-funnel", label: "Embudo de Ventas", colSpan: 12 },
  { id: "performance-chart", label: "Desempeño de Ventas", colSpan: 8 },
  { id: "client-distribution", label: "Distribución de Clientes", colSpan: 4 },
  { id: "opportunity-card", label: "Oportunidad Clave", colSpan: 4 },
  { id: "objectives-card", label: "Objetivos del Mes", colSpan: 4 },
  { id: "recent-accounts", label: "Cuentas Recientes", colSpan: 4 },
  { id: "recent-opps", label: "Oportunidades Recientes", colSpan: 8 },
  { id: "global-pipeline", label: "Global Pipeline", colSpan: 4 },
];

const STORAGE_KEY = "crm_dashboard_tile_order";

function loadOrder(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === "string")) {
      return parsed;
    }
  } catch { }
  return null;
}

function saveOrder(order: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

const COL_SPAN_CLASS: Record<number, string> = {
  4: "lg:col-span-4",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

interface DashboardGridProps {
  tiles: Record<string, React.ReactNode>;
  isEditing: boolean;
  onOrderChange?: (order: string[]) => void;
}

export function DashboardGrid({ tiles, isEditing, onOrderChange }: DashboardGridProps) {
  const [tileOrder, setTileOrder] = useState<string[]>(() => {
    const saved = loadOrder();
    const defaultOrder = DEFAULT_TILES.map((t) => t.id);
    if (!saved) return defaultOrder;
    // Validate saved order contains all current tile IDs
    const savedSet = new Set(saved);
    const defaultSet = new Set(defaultOrder);
    if (defaultOrder.every((id) => savedSet.has(id))) {
      // Filter out any tiles that no longer exist
      return saved.filter((id) => defaultSet.has(id));
    }
    return defaultOrder;
  });

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  const tileMap = Object.fromEntries(DEFAULT_TILES.map((t) => [t.id, t]));

  useEffect(() => {
    onOrderChange?.(tileOrder);
  }, [tileOrder, onOrderChange]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedId(null);
    setDragOverId(null);
    dragCounter.current = {};
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragCounter.current[id] = (dragCounter.current[id] || 0) + 1;
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragCounter.current[id] = (dragCounter.current[id] || 0) - 1;
    if (dragCounter.current[id] <= 0) {
      dragCounter.current[id] = 0;
      if (dragOverId === id) {
        setDragOverId(null);
      }
    }
  }, [dragOverId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId) {
        setDragOverId(null);
        dragCounter.current = {};
        return;
      }

      setTileOrder((prev) => {
        const newOrder = [...prev];
        const sourceIdx = newOrder.indexOf(sourceId);
        const targetIdx = newOrder.indexOf(targetId);
        if (sourceIdx === -1 || targetIdx === -1) return prev;
        newOrder.splice(sourceIdx, 1);
        newOrder.splice(targetIdx, 0, sourceId);
        return newOrder;
      });
      setDragOverId(null);
      dragCounter.current = {};
    },
    []
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {tileOrder.map((id) => {
        const def = tileMap[id];
        if (!def || !tiles[id]) return null;

        const isBeingDragged = draggedId === id;
        const isDragTarget = dragOverId === id && draggedId !== id;

        return (
          <div
            key={id}
            className={`${COL_SPAN_CLASS[def.colSpan] || "lg:col-span-12"} relative transition-all duration-200 ${isEditing ? "cursor-grab active:cursor-grabbing" : ""
              } ${isBeingDragged ? "opacity-50 scale-[0.98]" : ""} ${isDragTarget ? "ring-2 ring-[#254153] ring-offset-2 rounded-2xl" : ""
              }`}
            draggable={isEditing}
            onDragStart={(e) => isEditing && handleDragStart(e, id)}
            onDragEnd={isEditing ? handleDragEnd : undefined}
            onDragEnter={(e) => isEditing && handleDragEnter(e, id)}
            onDragLeave={(e) => isEditing && handleDragLeave(e, id)}
            onDragOver={isEditing ? handleDragOver : undefined}
            onDrop={(e) => isEditing && handleDrop(e, id)}
          >
            {/* Edit mode overlay */}
            {isEditing && (
              <div className="absolute inset-0 z-10 border-2 border-dashed border-[#254153]/30 rounded-2xl bg-[#254153]/5 flex items-start justify-start pointer-events-none">
                <div className="flex items-center gap-2 bg-[#254153] text-white px-3 py-1.5 rounded-br-xl rounded-tl-2xl text-xs font-bold shadow-lg">
                  <GripVertical className="w-3.5 h-3.5" />
                  {def.label}
                </div>
              </div>
            )}
            {tiles[id]}
          </div>
        );
      })}
    </div>
  );
}

export function saveDashboardOrder(order: string[]) {
  saveOrder(order);
}

export function resetDashboardOrder() {
  localStorage.removeItem(STORAGE_KEY);
}
