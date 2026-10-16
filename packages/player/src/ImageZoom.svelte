<!--
  Full-screen image viewer (ADR 0009). A native modal <dialog> gives focus containment, Escape and
  the background made inert. Panning is native scrolling (finger, wheel, scrollbars, arrow keys
  once the image area has focus), plus mouse drag; zoom comes from buttons, + − 0 keys, pinch,
  Ctrl/trackpad wheel and double-click, always around a focal point that stays put.
-->
<script lang="ts">
import { tick } from "svelte";
import { usePlayer } from "./player.svelte.ts";

let {
  src,
  zoomSrc,
  alt,
  id,
}: { src: string; zoomSrc?: string | undefined; alt: string; id: string } =
  $props();
const p = usePlayer();

const MAX = 4;
const STEP = 1.5;
let dialog: HTMLDialogElement | undefined = $state();
let viewport: HTMLDivElement | undefined = $state();
let opener: HTMLButtonElement | undefined = $state();
let isOpen = $state(false);
let scale = $state(1);
/** Natural size of the image and size of the viewer, to fit the image at scale 1. */
let natural = $state({ w: 0, h: 0 });
let box = $state({ w: 0, h: 0 });
const fit = $derived(
  natural.w && box.w ? Math.min(box.w / natural.w, box.h / natural.h) : 0,
);
const size = $derived({
  w: Math.round(natural.w * fit * scale),
  h: Math.round(natural.h * fit * scale),
});

const clamp = (s: number) => Math.min(MAX, Math.max(1, s));

function open(): void {
  scale = 1;
  isOpen = true;
  dialog?.showModal();
}

function close(): void {
  dialog?.close();
}

/** Zooms to `next`, keeping the point (px, py) of the viewer — its centre by default — in place. */
async function zoomTo(next: number, px?: number, py?: number): Promise<void> {
  const v = viewport;
  const target = clamp(next);
  if (!v || target === scale) return;
  const x = px ?? v.clientWidth / 2;
  const y = py ?? v.clientHeight / 2;
  const fx = (v.scrollLeft + x) / scale;
  const fy = (v.scrollTop + y) / scale;
  scale = target;
  await tick();
  v.scrollLeft = fx * target - x;
  v.scrollTop = fy * target - y;
}

const local = (e: { clientX: number; clientY: number }) => {
  const r = (viewport as HTMLDivElement).getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top] as const;
};

// Pointer gestures: two pointers pinch, a mouse drags. One finger is left to native scrolling.
const pointers = new Map<number, { x: number; y: number }>();
let pinch: { distance: number; scale: number } | null = null;
let drag: { x: number; y: number } | null = null;
const spread = () => {
  const [a, b] = [...pointers.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};

function onPointerDown(e: PointerEvent): void {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) pinch = { distance: spread(), scale };
  else if (e.pointerType === "mouse" && e.button === 0) {
    drag = { x: e.clientX, y: e.clientY };
    viewport?.setPointerCapture(e.pointerId);
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2 && pinch.distance > 0) {
    const [a, b] = [...pointers.values()] as [
      { x: number; y: number },
      { x: number; y: number },
    ];
    const [mx, my] = local({
      clientX: (a.x + b.x) / 2,
      clientY: (a.y + b.y) / 2,
    });
    zoomTo((pinch.scale * spread()) / pinch.distance, mx, my);
  } else if (drag && viewport) {
    viewport.scrollLeft -= e.clientX - drag.x;
    viewport.scrollTop -= e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
  }
}

function onPointerEnd(e: PointerEvent): void {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  drag = null;
}

function onDoubleClick(e: MouseEvent): void {
  const [x, y] = local(e);
  zoomTo(scale > 1 ? 1 : 2.5, x, y);
}

// Listeners that must call preventDefault (non-passive) or live on the dialog itself.
$effect(() => {
  const d = dialog;
  const v = viewport;
  if (!d || !v) return;
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return; // plain wheel scrolls (pans); Ctrl + wheel and trackpad pinch zoom
    e.preventDefault();
    const [x, y] = local(e);
    zoomTo(scale * Math.exp(-e.deltaY / 200), x, y);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") zoomTo(scale * STEP);
    else if (e.key === "-") zoomTo(scale / STEP);
    else if (e.key === "0") zoomTo(1);
    else return;
    e.preventDefault();
  };
  const observer = new ResizeObserver(() => {
    box = { w: v.clientWidth, h: v.clientHeight };
  });
  observer.observe(v);
  v.addEventListener("wheel", onWheel, { passive: false });
  d.addEventListener("keydown", onKey);
  return () => {
    observer.disconnect();
    v.removeEventListener("wheel", onWheel);
    d.removeEventListener("keydown", onKey);
  };
});
</script>

<button class="open" bind:this={opener} onclick={open} aria-haspopup="dialog">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" />
  </svg>
  <span class="visually-hidden">{p.ui("zoom.open")}</span>
</button>

<dialog
  bind:this={dialog}
  class="zoom"
  aria-labelledby="{id}-title"
  onclose={() => {
    isOpen = false;
    opener?.focus();
  }}
>
  <h2 class="visually-hidden" id="{id}-title">{p.ui("zoom.title")}</h2>
  <div class="toolbar">
    <div class="controls">
      <button onclick={() => zoomTo(scale / STEP)} disabled={scale <= 1}>
        <span aria-hidden="true">−</span>
        <span class="visually-hidden">{p.ui("zoom.out")}</span>
      </button>
      <output class="level" aria-live="polite">
        {p.ui("zoom.level", { percent: Math.round(scale * 100) })}
      </output>
      <button onclick={() => zoomTo(scale * STEP)} disabled={scale >= MAX}>
        <span aria-hidden="true">+</span>
        <span class="visually-hidden">{p.ui("zoom.in")}</span>
      </button>
      <button class="text" onclick={() => zoomTo(1)} disabled={scale <= 1}>
        {p.ui("zoom.reset")}
      </button>
    </div>
    <button class="text close" onclick={close}>{p.ui("zoom.close")}</button>
  </div>
  <!-- Image coordinates are physical: the scroll area stays left-to-right in every language. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="viewport"
    class:zoomed={scale > 1}
    bind:this={viewport}
    dir="ltr"
    tabindex="0"
    role="group"
    aria-label={p.ui("zoom.area")}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerEnd}
    onpointercancel={onPointerEnd}
    ondblclick={onDoubleClick}
  >
    {#if isOpen}
      <img
        src={zoomSrc ?? src}
        {alt}
        draggable="false"
        style:inline-size={size.w ? `${size.w}px` : undefined}
        style:block-size={size.h ? `${size.h}px` : undefined}
        onload={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          natural = { w: img.naturalWidth, h: img.naturalHeight };
        }}
      />
    {/if}
  </div>
  <p class="hint">{p.ui("zoom.hint")}</p>
</dialog>

<style>
  .open {
    position: absolute;
    inset-block-end: var(--space-3);
    inset-inline-end: var(--space-3);
    display: grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    padding: 0;
    border: 2px solid var(--color-surface);
    border-radius: 50%;
    background: var(--color-ink);
    color: var(--color-surface);
    box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
    cursor: zoom-in;
  }
  .open svg {
    inline-size: 22px;
    block-size: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .zoom {
    inline-size: 100vw;
    block-size: 100dvh;
    max-inline-size: none;
    max-block-size: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--color-ink);
    color: var(--color-surface);
  }
  .zoom[open] {
    display: grid;
    grid-template-rows: auto 1fr auto;
  }
  .zoom::backdrop {
    background: var(--color-ink);
  }
  :global(html:has(dialog.zoom[open])) {
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .toolbar button {
    min-inline-size: 44px;
    min-block-size: 44px;
    padding-inline: var(--space-3);
    border: 1px solid var(--color-ink-muted);
    border-radius: var(--radius-sm);
    background: var(--color-ink);
    color: var(--color-surface);
    font: inherit;
    font-size: var(--text-lg);
    cursor: pointer;
  }
  .toolbar button.text {
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .toolbar button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .toolbar :focus-visible,
  .viewport:focus-visible {
    outline: 3px solid var(--color-surface);
    outline-offset: -3px;
  }
  .level {
    min-inline-size: 4.5rem;
    text-align: center;
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  /* Flex + auto margins centre the image without clipping it once it overflows. */
  .viewport {
    display: flex;
    overflow: auto;
    overscroll-behavior: contain;
    touch-action: pan-x pan-y;
    cursor: zoom-in;
  }
  .viewport.zoomed {
    cursor: grab;
  }
  .viewport img {
    flex: none;
    margin: auto;
    max-inline-size: none;
    user-select: none;
  }
  .hint {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    text-align: center;
    color: var(--color-line);
  }
</style>
