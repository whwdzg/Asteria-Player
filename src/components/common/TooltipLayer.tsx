import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayRoot } from '../../hooks/useOverlayRoot';

interface TooltipState {
  text: string;
  anchor: DOMRect;
}

/**
 * Document-level tooltip surface.
 *
 * Tooltips used to be pseudo-elements on each button, which meant any ancestor
 * with `overflow: hidden` (video frame, queue scroller, settings popover)
 * clipped the label. A single fixed portal layer lets every control overflow
 * its original bounds without changing each component.
 */
export function TooltipLayer(): React.ReactElement | null {
  const root = useOverlayRoot();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState({ top: -1000, left: -1000 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLElement | null>(null);
  const pending = useRef<HTMLElement | null>(null);
  const showTimer = useRef(0);

  useEffect(() => {
    const hide = (): void => {
      window.clearTimeout(showTimer.current);
      current.current = null;
      pending.current = null;
      setTip(null);
    };
    const show = (target: HTMLElement, delay: number): void => {
      const text = target.getAttribute('data-tooltip') || target.getAttribute('aria-label') || '';
      if (!text.trim()) return;
      window.clearTimeout(showTimer.current);
      pending.current = target;
      showTimer.current = window.setTimeout(() => {
        if (pending.current !== target) return;
        pending.current = null;
        current.current = target;
        setTip({ text, anchor: target.getBoundingClientRect() });
      }, delay);
    };
    const onPointerOver = (event: PointerEvent): void => {
      const target = (event.target as Element | null)?.closest<HTMLElement>('[data-tooltip]');
      if (!target || current.current === target || pending.current === target) return;
      show(target, 240);
    };
    const onPointerOut = (event: PointerEvent): void => {
      const related = event.relatedTarget;
      const active = current.current;
      const pendingTarget = pending.current;
      if (pendingTarget) {
        if (related instanceof Node && pendingTarget.contains(related)) return;
        window.clearTimeout(showTimer.current);
        pending.current = null;
      }
      if (!active) return;
      if (related instanceof Node && active.contains(related)) return;
      hide();
    };
    const onFocusIn = (event: FocusEvent): void => {
      const target = (event.target as Element | null)?.closest<HTMLElement>('[data-tooltip]');
      if (target) show(target, 120);
    };
    const onFocusOut = (): void => hide();
    const onScroll = (): void => hide();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide();
    };

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.clearTimeout(showTimer.current);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tip) return;
    const element = tooltipRef.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let top = tip.anchor.top - box.height - 10;
    if (top < 8) top = Math.min(viewportHeight - box.height - 8, tip.anchor.bottom + 10);
    const left = Math.min(
      Math.max(8, tip.anchor.left + tip.anchor.width / 2 - box.width / 2),
      Math.max(8, viewportWidth - box.width - 8),
    );
    setPosition({ top, left });
  }, [tip]);

  if (!tip) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="app-tooltip"
      role="tooltip"
      style={{ top: position.top, left: position.left }}
    >
      {tip.text}
    </div>,
    root,
  );
}
