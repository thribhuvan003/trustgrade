'use client';

import { useRef, useState } from 'react';

// A pane divider you can drag, like a code editor. The size is held as a
// percentage so the split survives a window resize, and the grab area is wider
// than the line it draws so it is actually catchable with a mouse.
export default function SplitPane({ first, second, initial = 40, min = 22, max = 72, row = true }) {
  const container = useRef(null);
  const [size, setSize] = useState(initial);

  function clamp(value) {
    return Math.min(max, Math.max(min, value));
  }

  function startDrag(event) {
    event.preventDefault();
    const move = (moved) => {
      const box = container.current.getBoundingClientRect();
      const fraction = row
        ? (moved.clientX - box.left) / box.width
        : (moved.clientY - box.top) / box.height;
      setSize(clamp(fraction * 100));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = row ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function nudge(event) {
    const back = row ? 'ArrowLeft' : 'ArrowUp';
    const forward = row ? 'ArrowRight' : 'ArrowDown';
    if (event.key === back) setSize((current) => clamp(current - 2));
    if (event.key === forward) setSize((current) => clamp(current + 2));
  }

  return (
    <div ref={container} className={`flex h-full min-h-0 min-w-0 ${row ? '' : 'flex-col'}`}>
      <div
        style={row ? { width: `${size}%` } : { height: `${size}%` }}
        className="min-h-0 min-w-0 shrink-0 overflow-hidden"
      >
        {first}
      </div>

      <div
        role="separator"
        aria-orientation={row ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(size)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={row ? 'Resize panes horizontally' : 'Resize panes vertically'}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={nudge}
        title="Drag to resize"
        className={`group relative shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
          row ? 'w-[9px] cursor-col-resize' : 'h-[9px] cursor-row-resize'
        }`}
      >
        <div
          className={`absolute bg-border group-hover:bg-accent group-focus:bg-accent ${
            row ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
          }`}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
