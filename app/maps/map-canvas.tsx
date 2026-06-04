"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NoteBlank, Trash } from "@phosphor-icons/react";
import { TagBadge } from "@/components/tag-badge";

interface StickyTag {
  id: string;
  name: string;
  color: string | null;
}

interface StickyPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
}

export interface StickyData {
  id: string;
  summary: string | null;
  quotes: string[];
  is_action_item: boolean;
  tags: StickyTag[];
  position: StickyPosition | null;
}

interface AccountTag {
  id: string;
  name: string;
  color: string | null;
}

interface MapCanvasProps {
  customerId: string;
  stickies: StickyData[];
  accountTags: AccountTag[];
}

const STICKY_WIDTH = 220;
const STICKY_HEIGHT = 160;
const STICKY_MIN_WIDTH = 140;
const STICKY_MIN_HEIGHT = 100;
const STICKY_GAP_X = 24;
const STICKY_GAP_Y = 24;
const HEADER_OFFSET_Y = 56;
const COLUMN_GAP = 80;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

interface StickyColorOption {
  key: string;
  label: string;
  // Tailwind classes applied to the sticky body for this color.
  bodyClass: string;
  // Smaller class set for the picker swatch button.
  swatchClass: string;
}

const STICKY_COLOR_OPTIONS: readonly StickyColorOption[] = [
  {
    key: "yellow",
    label: "Pale yellow",
    bodyClass:
      "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700 text-gray-900 dark:text-yellow-50",
    swatchClass: "bg-yellow-200 border-yellow-400",
  },
  {
    key: "blue",
    label: "Pale blue",
    bodyClass:
      "bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 text-gray-900 dark:text-blue-50",
    swatchClass: "bg-blue-100 border-blue-300",
  },
  {
    key: "green",
    label: "Pale green",
    bodyClass:
      "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-gray-900 dark:text-green-50",
    swatchClass: "bg-green-200 border-green-400",
  },
  {
    key: "purple",
    label: "Pale purple",
    bodyClass:
      "bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-gray-900 dark:text-purple-50",
    swatchClass: "bg-purple-200 border-purple-400",
  },
  {
    key: "pink",
    label: "Pale pink",
    bodyClass:
      "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700 text-gray-900 dark:text-pink-50",
    swatchClass: "bg-pink-200 border-pink-400",
  },
  {
    key: "transparent",
    label: "Transparent",
    bodyClass:
      "bg-transparent border-dashed border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white",
    swatchClass: "bg-white dark:bg-gray-700 border-dashed border-gray-500 dark:border-gray-400",
  },
] as const;

const COLOR_OPTION_BY_KEY = new Map(STICKY_COLOR_OPTIONS.map((o) => [o.key, o]));

function resolveStickyColor(sticky: LaidOutSticky): StickyColorOption {
  const saved = sticky.effectivePosition.color;
  if (saved) {
    const opt = COLOR_OPTION_BY_KEY.get(saved);
    if (opt) return opt;
  }
  // No saved color: action items keep their yellow tint, everything else
  // defaults to blue (preserves the prior behaviour).
  return sticky.is_action_item
    ? COLOR_OPTION_BY_KEY.get("yellow")!
    : COLOR_OPTION_BY_KEY.get("blue")!;
}

interface LaidOutSticky extends StickyData {
  effectivePosition: StickyPosition;
}

function getPrimaryTagName(s: StickyData): string {
  return s.tags[0]?.name ?? "Untagged";
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesIntersect(a: Box, b: Box): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Scan from (startX, startY) downward looking for an empty slot. Each step
 * down is one sticky height plus a gap. If a column fills up, shift right and
 * restart at startY. Returns the first non-colliding position.
 */
function findFreeSlot(startX: number, startY: number, obstacles: Box[]): { x: number; y: number } {
  const stepY = STICKY_HEIGHT + STICKY_GAP_Y;
  const stepX = STICKY_WIDTH + STICKY_GAP_X;
  const maxRows = 40;
  const maxCols = 20;
  for (let col = 0; col < maxCols; col++) {
    for (let row = 0; row < maxRows; row++) {
      const x = startX + col * stepX;
      const y = startY + row * stepY;
      const candidate: Box = { x, y, width: STICKY_WIDTH, height: STICKY_HEIGHT };
      if (!obstacles.some((o) => boxesIntersect(candidate, o))) return { x, y };
    }
  }
  return { x: startX, y: startY };
}

/**
 * For each unpositioned sticky, try to place it inside the cluster of already-
 * positioned stickies that share its primary tag — directly below the lowest
 * member, aligned with the cluster's average x. If no cluster exists for that
 * tag, start a new column to the right of all existing content. `findFreeSlot`
 * does the actual collision avoidance. Iteration order follows `stickies`
 * (which the server returns by created_at) so placement is deterministic.
 */
function computeAutoLayout(stickies: StickyData[]): Map<string, StickyPosition> {
  const result = new Map<string, StickyPosition>();
  const positioned = stickies.filter((s) => s.position);
  const unpositioned = stickies.filter((s) => !s.position);

  const obstacles: Box[] = positioned.map((s) => ({
    x: s.position!.x,
    y: s.position!.y,
    width: s.position!.width,
    height: s.position!.height,
  }));

  const clusters = new Map<string, Box[]>();
  for (const s of positioned) {
    const tag = getPrimaryTagName(s);
    const list = clusters.get(tag) ?? [];
    list.push({
      x: s.position!.x,
      y: s.position!.y,
      width: s.position!.width,
      height: s.position!.height,
    });
    clusters.set(tag, list);
  }

  let untaggedColumnX: number | null = null;

  for (const s of unpositioned) {
    const tag = getPrimaryTagName(s);
    const cluster = clusters.get(tag);
    let startX: number;
    let startY: number;
    if (cluster && cluster.length > 0) {
      const avgX = Math.round(cluster.reduce((acc, c) => acc + c.x, 0) / cluster.length);
      const maxBottom = Math.max(...cluster.map((c) => c.y + c.height));
      startX = avgX;
      startY = maxBottom + STICKY_GAP_Y;
    } else if (tag === "Untagged" && untaggedColumnX !== null) {
      startX = untaggedColumnX;
      startY = HEADER_OFFSET_Y;
    } else {
      const rightmost = obstacles.length
        ? Math.max(...obstacles.map((b) => b.x + b.width))
        : 80 - COLUMN_GAP;
      startX = rightmost + COLUMN_GAP;
      startY = HEADER_OFFSET_Y;
      if (tag === "Untagged") untaggedColumnX = startX;
    }
    const slot = findFreeSlot(startX, startY, obstacles);
    const pos: StickyPosition = {
      x: slot.x,
      y: slot.y,
      width: STICKY_WIDTH,
      height: STICKY_HEIGHT,
      color: null,
    };
    result.set(s.id, pos);
    const newBox: Box = { x: slot.x, y: slot.y, width: STICKY_WIDTH, height: STICKY_HEIGHT };
    obstacles.push(newBox);
    const list = clusters.get(tag) ?? [];
    list.push(newBox);
    clusters.set(tag, list);
  }

  return result;
}

export function MapCanvas({
  customerId,
  stickies: initialStickies,
  accountTags,
}: MapCanvasProps) {
  // Auto-layout for any sticky that doesn't already have a saved position.
  const autoPositions = useMemo(() => computeAutoLayout(initialStickies), [initialStickies]);

  const [stickies, setStickies] = useState<LaidOutSticky[]>(() =>
    initialStickies.map((s) => ({
      ...s,
      effectivePosition:
        s.position ??
        autoPositions.get(s.id) ?? {
          x: 80,
          y: HEADER_OFFSET_Y,
          width: STICKY_WIDTH,
          height: STICKY_HEIGHT,
          color: null,
        },
    }))
  );

  // Persist auto-placed positions so next visit treats them as fixed and only
  // truly new extracts get re-laid-out. Fire-and-forget with keepalive so the
  // requests complete even if the user navigates away immediately.
  useEffect(() => {
    initialStickies.forEach((s) => {
      if (s.position) return;
      const auto = autoPositions.get(s.id);
      if (!auto) return;
      fetch("/api/extract-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          extract_id: s.id,
          x: Math.round(auto.x),
          y: Math.round(auto.y),
          width: auto.width,
          height: auto.height,
        }),
      }).catch((err) => console.error("Failed to persist auto-placed position:", err));
    });
    // Only re-run when the underlying initialStickies set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStickies]);

  const allTags = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    for (const s of stickies) {
      for (const t of s.tags) {
        if (!map.has(t.id)) map.set(t.id, { name: t.name, color: t.color });
      }
    }
    return Array.from(map, ([id, v]) => ({ id, name: v.name, color: v.color })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [stickies]);

  // null = "show all". When a Set, only stickies with at least one matching tag are visible.
  const [activeTagFilter, setActiveTagFilter] = useState<Set<string> | null>(null);

  // Multi-select mode for bulk actions (delete, add tag, group).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<null | "delete" | "addTag">(null);
  // Stickies created via the "+ new sticky" button — these get auto-opened in
  // edit mode and focused on first render.
  const [newStickyIds, setNewStickyIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scale: 1, panX: 0, panY: 0 });
  const panState = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  // dragState carries one or more "members" so the same gesture supports a
  // single-sticky drag (normal mode) and a group drag (select mode). An empty
  // members array means the pointer-down was on an unselected sticky while in
  // select mode — we still track the pointer so we can toggle selection on
  // pointer-up, but we won't move anything.
  const dragState = useRef<{
    stickyId: string;
    pointerId: number;
    members: Array<{ id: string; originX: number; originY: number }>;
    startClientX: number;
    startClientY: number;
    started: boolean;
  } | null>(null);
  const DRAG_THRESHOLD_PX = 4;

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setViewport((v) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * Math.exp(delta)));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...v, scale: nextScale };
      // Zoom toward the cursor.
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ratio = nextScale / v.scale;
      return {
        scale: nextScale,
        panX: cx - (cx - v.panX) * ratio,
        panY: cy - (cy - v.panY) * ratio,
      };
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current) return;
    // Buttons/inputs inside the canvas (zoom controls, sticky edit UI) mark
    // themselves with data-no-drag. Don't start a pan over them or pointer
    // capture will swallow their click.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    panState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: viewport.panX,
      originY: viewport.panY,
    };
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current) {
      const d = dragState.current;
      const rawDx = e.clientX - d.startClientX;
      const rawDy = e.clientY - d.startClientY;
      if (!d.started) {
        if (Math.hypot(rawDx, rawDy) < DRAG_THRESHOLD_PX) return;
        d.started = true;
        // No members = an unselected click in select mode. Don't capture or
        // move; we just want the pointerup to fire so we can toggle selection.
        if (d.members.length === 0) return;
        containerRef.current?.setPointerCapture(d.pointerId);
      }
      if (d.members.length === 0) return;
      const dx = rawDx / viewport.scale;
      const dy = rawDy / viewport.scale;
      const byId = new Map(d.members.map((m) => [m.id, m]));
      setStickies((prev) =>
        prev.map((s) => {
          const m = byId.get(s.id);
          if (!m) return s;
          return {
            ...s,
            effectivePosition: { ...s.effectivePosition, x: m.originX + dx, y: m.originY + dy },
          };
        })
      );
      return;
    }
    if (!panState.current.active) return;
    const dx = e.clientX - panState.current.startX;
    const dy = e.clientY - panState.current.startY;
    setViewport((v) => ({ ...v, panX: panState.current.originX + dx, panY: panState.current.originY + dy }));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current && dragState.current.pointerId === e.pointerId) {
      const finished = dragState.current;
      dragState.current = null;
      // Click (no threshold crossed). In select mode → toggle selection.
      // In normal mode → let the browser deliver click/dblclick naturally.
      if (!finished.started) {
        panState.current.active = false;
        if (selectMode) {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(finished.stickyId)) next.delete(finished.stickyId);
            else next.add(finished.stickyId);
            return next;
          });
        }
        return;
      }
      // Drag — if members is empty (unselected sticky in select mode) nothing
      // to save. Otherwise commit + persist each member.
      if (finished.members.length > 0) {
        const dx = (e.clientX - finished.startClientX) / viewport.scale;
        const dy = (e.clientY - finished.startClientY) / viewport.scale;
        const byId = new Map(finished.members.map((m) => [m.id, m]));
        setStickies((prev) =>
          prev.map((s) => {
            const m = byId.get(s.id);
            if (!m) return s;
            return {
              ...s,
              effectivePosition: { ...s.effectivePosition, x: m.originX + dx, y: m.originY + dy },
            };
          })
        );
        const lookup = new Map(stickies.map((s) => [s.id, s]));
        for (const m of finished.members) {
          const sticky = lookup.get(m.id);
          const width = sticky?.effectivePosition.width ?? STICKY_WIDTH;
          const height = sticky?.effectivePosition.height ?? STICKY_HEIGHT;
          const color = sticky?.effectivePosition.color;
          fetch("/api/extract-positions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              extract_id: m.id,
              x: Math.round(m.originX + dx),
              y: Math.round(m.originY + dy),
              width,
              height,
              ...(color ? { color } : {}),
            }),
          })
            .then((r) => {
              if (!r.ok) console.error("Save position failed:", r.status);
            })
            .catch((err) => console.error("Failed to save position:", err));
        }
      }
    }
    panState.current.active = false;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function startStickyDrag(e: React.PointerEvent<HTMLDivElement>, stickyId: string) {
    // Anything marked as an interactive control inside the sticky vetoes a drag.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    e.stopPropagation();
    const sticky = stickies.find((s) => s.id === stickyId);
    if (!sticky) return;
    // Compose drag members. In select mode, dragging a selected sticky moves
    // the whole selection. Dragging an unselected sticky just primes a click —
    // pointerup will toggle selection on it.
    let members: Array<{ id: string; originX: number; originY: number }>;
    if (selectMode) {
      if (selectedIds.has(stickyId)) {
        members = stickies
          .filter((s) => selectedIds.has(s.id))
          .map((s) => ({
            id: s.id,
            originX: s.effectivePosition.x,
            originY: s.effectivePosition.y,
          }));
      } else {
        members = [];
      }
    } else {
      members = [
        {
          id: stickyId,
          originX: sticky.effectivePosition.x,
          originY: sticky.effectivePosition.y,
        },
      ];
    }
    dragState.current = {
      stickyId,
      pointerId: e.pointerId,
      members,
      startClientX: e.clientX,
      startClientY: e.clientY,
      started: false,
    };
    // Don't capture the pointer yet — capturing here suppresses click/dblclick
    // on the original target. We capture only once movement crosses the
    // drag threshold (see onPointerMove).
  }

  async function handleUpdateSummary(stickyId: string, nextSummary: string): Promise<void> {
    // Optimistic.
    setStickies((prev) =>
      prev.map((s) => (s.id === stickyId ? { ...s, summary: nextSummary } : s))
    );
    try {
      const response = await fetch(`/api/extracts/${stickyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: nextSummary }),
      });
      if (!response.ok) console.error("Save summary failed:", response.status);
    } catch (err) {
      console.error("Failed to save summary:", err);
    }
  }

  async function handleAddTag(
    stickyId: string,
    tag: { id?: string; name?: string }
  ): Promise<void> {
    try {
      const response = await fetch(`/api/extracts/${stickyId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.id, tag_name: tag.name }),
      });
      if (!response.ok) {
        console.error("Add tag failed:", response.status);
        return;
      }
      const data = (await response.json()) as { tag: StickyTag };
      setStickies((prev) =>
        prev.map((s) =>
          s.id === stickyId && !s.tags.find((t) => t.id === data.tag.id)
            ? { ...s, tags: [...s.tags, data.tag] }
            : s
        )
      );
    } catch (err) {
      console.error("Failed to add tag:", err);
    }
  }

  async function handleRemoveTag(stickyId: string, tagId: string): Promise<void> {
    // Optimistic.
    setStickies((prev) =>
      prev.map((s) =>
        s.id === stickyId ? { ...s, tags: s.tags.filter((t) => t.id !== tagId) } : s
      )
    );
    try {
      const response = await fetch(`/api/extracts/${stickyId}/tags/${tagId}`, {
        method: "DELETE",
      });
      if (!response.ok) console.error("Remove tag failed:", response.status);
    } catch (err) {
      console.error("Failed to remove tag:", err);
    }
  }

  async function handleUpdateColor(stickyId: string, color: string): Promise<void> {
    const target = stickies.find((s) => s.id === stickyId);
    if (!target) return;
    const { x, y, width, height } = target.effectivePosition;
    // Optimistic.
    setStickies((prev) =>
      prev.map((s) =>
        s.id === stickyId
          ? { ...s, effectivePosition: { ...s.effectivePosition, color } }
          : s
      )
    );
    try {
      const response = await fetch("/api/extract-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          extract_id: stickyId,
          x: Math.round(x),
          y: Math.round(y),
          width,
          height,
          color,
        }),
      });
      if (!response.ok) console.error("Save color failed:", response.status);
    } catch (err) {
      console.error("Failed to save color:", err);
    }
  }

  /** Live resize — updates state only, no network. */
  function handleResizeLive(stickyId: string, width: number, height: number): void {
    setStickies((prev) =>
      prev.map((s) =>
        s.id === stickyId
          ? { ...s, effectivePosition: { ...s.effectivePosition, width, height } }
          : s
      )
    );
  }

  /** Resize commit — persists the final dimensions. */
  async function handleResizeCommit(stickyId: string): Promise<void> {
    const target = stickies.find((s) => s.id === stickyId);
    if (!target) return;
    const { x, y, width, height, color } = target.effectivePosition;
    try {
      const response = await fetch("/api/extract-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          extract_id: stickyId,
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
          ...(color ? { color } : {}),
        }),
      });
      if (!response.ok) console.error("Save size failed:", response.status);
    } catch (err) {
      console.error("Failed to save size:", err);
    }
  }

  async function handleDelete(stickyId: string): Promise<void> {
    const snapshot = stickies;
    setStickies((prev) => prev.filter((s) => s.id !== stickyId));
    try {
      const response = await fetch(`/api/extracts/${stickyId}`, { method: "DELETE" });
      if (!response.ok) {
        console.error("Delete extract failed:", response.status);
        setStickies(snapshot);
      }
    } catch (err) {
      console.error("Failed to delete extract:", err);
      setStickies(snapshot);
    }
  }

  function exitSelectMode(): void {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkDialog(null);
  }

  async function handleBulkDelete(): Promise<void> {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setBulkDialog(null);
      return;
    }
    const snapshot = stickies;
    setStickies((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setBulkDialog(null);
    exitSelectMode();
    const responses = await Promise.allSettled(
      ids.map((id) => fetch(`/api/extracts/${id}`, { method: "DELETE", keepalive: true }))
    );
    const anyFailed = responses.some(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
    );
    if (anyFailed) {
      console.error("Some bulk deletes failed; rolling back local state");
      setStickies(snapshot);
    }
  }

  async function handleBulkAddTag(tag: { id?: string; name?: string }): Promise<void> {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setBulkDialog(null);
      return;
    }
    setBulkDialog(null);
    const responses = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/extracts/${id}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify(tag),
        })
      )
    );
    let resolvedTag: StickyTag | null = null;
    for (const r of responses) {
      if (r.status === "fulfilled" && r.value.ok) {
        try {
          const data = (await r.value.clone().json()) as { tag: StickyTag };
          resolvedTag = data.tag;
          break;
        } catch {
          // try next
        }
      }
    }
    if (resolvedTag) {
      const t = resolvedTag;
      setStickies((prev) =>
        prev.map((s) => {
          if (!selectedIds.has(s.id)) return s;
          if (s.tags.find((existing) => existing.id === t.id)) return s;
          return { ...s, tags: [...s.tags, t] };
        })
      );
    }
    exitSelectMode();
  }

  function handleGroupSelected(): void {
    const selected = stickies.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;
    const avgX = Math.round(selected.reduce((a, s) => a + s.effectivePosition.x, 0) / selected.length);
    const avgY = Math.round(selected.reduce((a, s) => a + s.effectivePosition.y, 0) / selected.length);
    const cols = Math.max(1, Math.ceil(Math.sqrt(selected.length)));
    const cellW = STICKY_WIDTH + 16;
    const cellH = STICKY_HEIGHT + 16;
    const startX = avgX - Math.floor(cols / 2) * cellW;
    const startY = avgY;
    const updates = selected.map((s, i) => ({
      id: s.id,
      x: startX + (i % cols) * cellW,
      y: startY + Math.floor(i / cols) * cellH,
      width: s.effectivePosition.width,
      height: s.effectivePosition.height,
      color: s.effectivePosition.color,
    }));
    const byId = new Map(updates.map((u) => [u.id, u]));
    setStickies((prev) =>
      prev.map((s) => {
        const u = byId.get(s.id);
        if (!u) return s;
        return { ...s, effectivePosition: { ...s.effectivePosition, x: u.x, y: u.y } };
      })
    );
    for (const u of updates) {
      fetch("/api/extract-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          extract_id: u.id,
          x: Math.round(u.x),
          y: Math.round(u.y),
          width: u.width,
          height: u.height,
          ...(u.color ? { color: u.color } : {}),
        }),
      }).catch((err) => console.error("Failed to save grouped position:", err));
    }
    exitSelectMode();
  }

  /**
   * Create a blank sticky at the visible centre of the canvas, persist its
   * starting position, and prepend it to local state so it appears immediately.
   */
  async function handleCreateBlankSticky(): Promise<void> {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Translate viewport-centre to canvas-space coordinates and centre the
    // sticky on that point.
    const centreX = (rect.width / 2 - viewport.panX) / viewport.scale - STICKY_WIDTH / 2;
    const centreY = (rect.height / 2 - viewport.panY) / viewport.scale - STICKY_HEIGHT / 2;
    let created: { id: string };
    try {
      const response = await fetch("/api/extracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (!response.ok) {
        console.error("Create sticky failed:", response.status);
        return;
      }
      const data = (await response.json()) as { extract: { id: string } };
      created = data.extract;
    } catch (err) {
      console.error("Failed to create sticky:", err);
      return;
    }
    const x = Math.round(centreX);
    const y = Math.round(centreY);
    fetch("/api/extract-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        extract_id: created.id,
        x,
        y,
        width: STICKY_WIDTH,
        height: STICKY_HEIGHT,
      }),
    }).catch((err) => console.error("Failed to save initial position:", err));
    setNewStickyIds((prev) => {
      const next = new Set(prev);
      next.add(created.id);
      return next;
    });
    setStickies((prev) => [
      ...prev,
      {
        id: created.id,
        summary: null,
        quotes: [],
        is_action_item: false,
        tags: [],
        position: null,
        effectivePosition: {
          x,
          y,
          width: STICKY_WIDTH,
          height: STICKY_HEIGHT,
          color: null,
        },
      },
    ]);
  }

  function zoomBy(factor: number) {
    setViewport((v) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...v, scale: nextScale };
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = nextScale / v.scale;
      return {
        scale: nextScale,
        panX: cx - (cx - v.panX) * ratio,
        panY: cy - (cy - v.panY) * ratio,
      };
    });
  }

  function resetView() {
    setViewport({ scale: 1, panX: 0, panY: 0 });
  }

  function toggleTagFilter(tagId: string) {
    setActiveTagFilter((curr) => {
      const next = new Set(curr ?? []);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next.size === 0 ? null : next;
    });
  }

  // Prevent the page from scrolling when the user wheel-zooms over the canvas
  // (React onWheel is passive in some browsers).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const visibleStickies = activeTagFilter
    ? stickies.filter((s) => s.tags.some((t) => activeTagFilter.has(t.id)))
    : stickies;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex flex-wrap items-center gap-2">
        {allTags.length > 0 && (
          <>
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">
              Filter
            </span>
            <button
              onClick={() => setActiveTagFilter(null)}
              className={`text-xs px-2 py-1 rounded border ${
                activeTagFilter === null
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              All
            </button>
            {allTags.map((t) => {
              const active = activeTagFilter?.has(t.id) ?? false;
              return (
                <TagBadge
                  key={t.id}
                  name={t.name}
                  color={t.color}
                  selected={active}
                  onClick={() => toggleTagFilter(t.id)}
                />
              );
            })}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!selectMode && (
            <>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {visibleStickies.length} / {stickies.length} stickies
              </span>
              <button
                onClick={() => setSelectMode(true)}
                className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Select
              </button>
            </>
          )}
          {selectMode && (
            <>
              <span className="text-xs text-gray-700 dark:text-gray-200">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setBulkDialog("delete")}
                disabled={selectedIds.size === 0}
                className="text-xs px-2 py-1 rounded border bg-red-600 text-white border-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => setBulkDialog("addTag")}
                disabled={selectedIds.size === 0}
                className="text-xs px-2 py-1 rounded border bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add tag
              </button>
              <button
                onClick={handleGroupSelected}
                disabled={selectedIds.size === 0}
                className="text-xs px-2 py-1 rounded border bg-purple-600 text-white border-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Group
              </button>
              <button
                onClick={exitSelectMode}
                className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex-1 overflow-hidden bg-[radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)] [background-size:24px_24px] dark:bg-[radial-gradient(circle,_rgba(255,255,255,0.06)_1px,_transparent_1px)] cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {stickies.map((s) => {
            const hidden = activeTagFilter && !s.tags.some((t) => activeTagFilter.has(t.id));
            return (
              <Sticky
                key={s.id}
                sticky={s}
                hidden={!!hidden}
                accountTags={accountTags}
                selectMode={selectMode}
                selected={selectedIds.has(s.id)}
                autoEdit={newStickyIds.has(s.id)}
                onDragStart={(e) => startStickyDrag(e, s.id)}
                onUpdateSummary={(next) => handleUpdateSummary(s.id, next)}
                onAddTag={(tag) => handleAddTag(s.id, tag)}
                onRemoveTag={(tagId) => handleRemoveTag(s.id, tagId)}
                onUpdateColor={(color) => handleUpdateColor(s.id, color)}
                onResizeLive={(w, h) => handleResizeLive(s.id, w, h)}
                onResizeCommit={() => handleResizeCommit(s.id)}
                onDelete={() => handleDelete(s.id)}
              />
            );
          })}
        </div>

        <div
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 flex flex-col gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-1"
        >
          {!selectMode && (
            <button
              type="button"
              onClick={handleCreateBlankSticky}
              title="New sticky"
              aria-label="New sticky"
              className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <NoteBlank size={18} weight="regular" />
            </button>
          )}
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            title="Zoom in"
            className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.2)}
            title="Zoom out"
            className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset view"
            className="w-8 h-8 flex items-center justify-center text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            1:1
          </button>
        </div>

        {stickies.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm pointer-events-none">
            No extracts for this organization yet.
          </div>
        )}
      </div>

      {bulkDialog === "delete" && (
        <BulkDeleteDialog
          count={selectedIds.size}
          onCancel={() => setBulkDialog(null)}
          onConfirm={handleBulkDelete}
        />
      )}
      {bulkDialog === "addTag" && (
        <BulkAddTagDialog
          count={selectedIds.size}
          accountTags={accountTags}
          onCancel={() => setBulkDialog(null)}
          onConfirm={(tag) => handleBulkAddTag(tag)}
        />
      )}
    </div>
  );
}

interface BulkDeleteDialogProps {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

function BulkDeleteDialog({ count, onCancel, onConfirm }: BulkDeleteDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete {count} extract{count === 1 ? "" : "s"}?
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This removes them from every map and meeting. Cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface BulkAddTagDialogProps {
  count: number;
  accountTags: AccountTag[];
  onCancel: () => void;
  onConfirm: (tag: { id?: string; name?: string }) => void;
}

function BulkAddTagDialog({ count, accountTags, onCancel, onConfirm }: BulkAddTagDialogProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const matches = trimmed
    ? accountTags.filter((t) => t.name.toLowerCase().includes(trimmed.toLowerCase()))
    : accountTags;
  const exact = accountTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Add tag to {count} extract{count === 1 ? "" : "s"}
        </h2>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed) {
              e.preventDefault();
              if (exact) onConfirm({ id: exact.id });
              else onConfirm({ name: trimmed });
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="Type to search or create…"
          className="w-full px-3 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md mb-3">
          {matches.slice(0, 20).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onConfirm({ id: t.id })}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: t.color ?? "#9ca3af" }}
              />
              <span className="text-gray-900 dark:text-white">{t.name}</span>
            </button>
          ))}
          {trimmed && !exact && (
            <button
              type="button"
              onClick={() => onConfirm({ name: trimmed })}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700"
            >
              + Create &ldquo;{trimmed}&rdquo;
            </button>
          )}
          {matches.length === 0 && !trimmed && (
            <div className="px-3 py-2 text-sm text-gray-500">No tags yet</div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface StickyProps {
  sticky: LaidOutSticky;
  hidden: boolean;
  accountTags: AccountTag[];
  selectMode: boolean;
  selected: boolean;
  autoEdit: boolean;
  onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onUpdateSummary: (next: string) => void;
  onAddTag: (tag: { id?: string; name?: string }) => void;
  onRemoveTag: (tagId: string) => void;
  onUpdateColor: (color: string) => void;
  onResizeLive: (width: number, height: number) => void;
  onResizeCommit: () => void;
  onDelete: () => void;
}

function Sticky({
  sticky,
  hidden,
  accountTags,
  selectMode,
  selected,
  autoEdit,
  onDragStart,
  onUpdateSummary,
  onAddTag,
  onRemoveTag,
  onUpdateColor,
  onResizeLive,
  onResizeCommit,
  onDelete,
}: StickyProps) {
  // Newly-created stickies (passed via autoEdit) open straight into edit mode.
  // Read autoEdit only at first render so later prop changes don't reopen
  // edit after the user has closed it.
  const [editingSummary, setEditingSummary] = useState(autoEdit);
  const [draftSummary, setDraftSummary] = useState(sticky.summary ?? "");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Keep draft in sync when sticky.summary changes from outside (e.g., parent state reset).
  useEffect(() => {
    if (!editingSummary) setDraftSummary(sticky.summary ?? "");
  }, [sticky.summary, editingSummary]);

  useEffect(() => {
    if (editingSummary) textareaRef.current?.focus();
  }, [editingSummary]);

  // Detect when the summary text overflows the available height. Recomputes on
  // text changes and on element resize (so the indicator updates as the user
  // drags the resize handle).
  useLayoutEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    function check() {
      if (!el) return;
      setTruncated(el.scrollHeight > el.clientHeight + 1);
    }
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sticky.summary, sticky.effectivePosition.width, sticky.effectivePosition.height, editingSummary]);

  function onResizePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    e.stopPropagation();
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: sticky.effectivePosition.width,
      startHeight: sticky.effectivePosition.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onResizePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    const w = Math.max(STICKY_MIN_WIDTH, Math.round(r.startWidth + (e.clientX - r.startX)));
    const h = Math.max(STICKY_MIN_HEIGHT, Math.round(r.startHeight + (e.clientY - r.startY)));
    onResizeLive(w, h);
  }

  function onResizePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onResizeCommit();
  }

  function commitSummary(): void {
    setEditingSummary(false);
    const next = draftSummary.trim();
    if (next === (sticky.summary ?? "").trim()) return;
    onUpdateSummary(next);
  }

  function cancelSummary(): void {
    setDraftSummary(sticky.summary ?? "");
    setEditingSummary(false);
  }

  function pickTag(tag: AccountTag): void {
    onAddTag({ id: tag.id });
    setTagPickerOpen(false);
    setTagQuery("");
  }

  function createTag(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddTag({ name: trimmed });
    setTagPickerOpen(false);
    setTagQuery("");
  }

  const attachedIds = new Set(sticky.tags.map((t) => t.id));
  const matchingTags = tagQuery
    ? accountTags.filter(
        (t) => !attachedIds.has(t.id) && t.name.toLowerCase().includes(tagQuery.toLowerCase())
      )
    : accountTags.filter((t) => !attachedIds.has(t.id));
  const exactExisting = accountTags.find(
    (t) => t.name.toLowerCase() === tagQuery.trim().toLowerCase()
  );

  const colorOption = resolveStickyColor(sticky);
  const activeColorKey = sticky.effectivePosition.color ?? colorOption.key;

  return (
    <div
      onPointerDown={onDragStart}
      style={{
        position: "absolute",
        left: sticky.effectivePosition.x,
        top: sticky.effectivePosition.y,
        width: sticky.effectivePosition.width,
        height: sticky.effectivePosition.height,
        display: hidden ? "none" : undefined,
      }}
      className={`group relative rounded-md shadow-md border p-3 ${
        selectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      } flex flex-col gap-2 text-xs overflow-visible ${colorOption.bodyClass} ${
        selectMode && selected ? "ring-2 ring-blue-500 ring-offset-1" : ""
      } ${selectMode && !selected ? "opacity-70 hover:opacity-100" : ""}`}
    >
      {/* Delete button — hover-visible at top right. Hidden in select mode. */}
      {!selectMode && (
        <button
          type="button"
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setConfirmingDelete(true)}
          title="Delete extract"
          aria-label="Delete extract"
          className="absolute top-1 right-1 z-10 w-5 h-5 flex items-center justify-center rounded text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-80 hover:!opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
        >
          <Trash size={14} />
        </button>
      )}
      {editingSummary && (
        <div
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5"
          role="radiogroup"
          aria-label="Sticky color"
        >
          {STICKY_COLOR_OPTIONS.map((opt) => {
            const selected = activeColorKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateColor(opt.key)}
                title={opt.label}
                aria-label={opt.label}
                aria-checked={selected}
                role="radio"
                className={`w-4 h-4 rounded-full border ${opt.swatchClass} transition-transform ${
                  selected
                    ? "ring-2 ring-offset-1 ring-gray-700 dark:ring-white"
                    : "hover:scale-110"
                }`}
              />
            );
          })}
        </div>
      )}
      {editingSummary ? (
        <textarea
          ref={textareaRef}
          value={draftSummary}
          onChange={(e) => setDraftSummary(e.target.value)}
          onBlur={commitSummary}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancelSummary();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitSummary();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          data-no-drag
          className="flex-1 resize-none rounded bg-white/70 dark:bg-black/30 text-xs p-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <div className="relative flex-1 min-h-0">
          <div
            ref={summaryRef}
            onDoubleClick={selectMode ? undefined : () => setEditingSummary(true)}
            className="font-medium leading-snug whitespace-pre-wrap overflow-hidden h-full"
            title={selectMode ? undefined : "Double-click to edit"}
          >
            {sticky.summary || <span className="italic opacity-60">(no summary)</span>}
          </div>
          {truncated && (
            <span
              aria-label="Content truncated"
              title="Content is truncated — resize the sticky to see more"
              className="absolute bottom-0 right-0 px-1 rounded bg-black/40 dark:bg-white/20 text-white dark:text-gray-100 text-[9px] leading-none pointer-events-none select-none"
            >
              …
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-1 items-center">
        {sticky.tags.map((t) => (
          <span key={t.id} className="inline-flex items-center" data-no-drag={!selectMode}>
            <TagBadge name={t.name} color={t.color} />
            {!selectMode && (
              <button
                type="button"
                data-no-drag
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onRemoveTag(t.id)}
                className="ml-0.5 text-[10px] opacity-50 hover:opacity-100"
                title="Remove tag"
                aria-label={`Remove tag ${t.name}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!selectMode && (tagPickerOpen ? (
          <div className="relative" data-no-drag onPointerDown={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setTagPickerOpen(false);
                  setTagQuery("");
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (exactExisting) pickTag(exactExisting);
                  else if (tagQuery.trim()) createTag(tagQuery);
                }
              }}
              onBlur={() => {
                // Close after the click on a list item has a chance to register.
                setTimeout(() => setTagPickerOpen(false), 150);
              }}
              placeholder="Tag name…"
              className="text-[11px] px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-28"
            />
            <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-40 overflow-y-auto">
              {matchingTags.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  data-no-drag
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickTag(t);
                  }}
                  className="w-full text-left px-2 py-1 text-[11px] hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: t.color ?? "#9ca3af" }}
                  />
                  {t.name}
                </button>
              ))}
              {tagQuery.trim() && !exactExisting && (
                <button
                  data-no-drag
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    createTag(tagQuery);
                  }}
                  className="w-full text-left px-2 py-1 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700"
                >
                  + Create &ldquo;{tagQuery.trim()}&rdquo;
                </button>
              )}
              {matchingTags.length === 0 && !tagQuery.trim() && (
                <div className="px-2 py-1 text-[11px] text-gray-500">No more tags</div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-no-drag
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setTagPickerOpen(true)}
            className="text-[11px] px-1.5 py-0.5 rounded border border-dashed border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-black/30"
            title="Add tag"
          >
            + tag
          </button>
        ))}
      </div>

      {/* Resize handle — bottom-right corner. Hidden in select mode. */}
      {!selectMode && (
        <div
          data-no-drag
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          title="Drag to resize"
          aria-label="Resize sticky"
          role="slider"
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-15 hover:opacity-40 rounded-full"
          style={{
            // Two short stripes forming a corner gripper.
            backgroundImage:
              "linear-gradient(135deg, transparent 0 55%, currentColor 25% 50%)",
          }}
        />
      )}

      {/* Delete confirmation overlay. Hidden in select mode. */}
      {!selectMode && confirmingDelete && (
        <div
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-3 rounded-md bg-white/95 dark:bg-gray-900/95"
        >
          <p className="text-xs text-center text-gray-900 dark:text-white">
            Delete this extract?
          </p>
          <p className="text-[10px] text-center text-gray-500 dark:text-gray-400">
            This removes it from every map and meeting.
          </p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                onDelete();
              }}
              className="px-2 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
