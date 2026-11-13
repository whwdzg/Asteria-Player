import { useCallback, useEffect, useRef, useState } from 'react';

type BackDirection = 'left' | 'right';

interface Options {
  direction: BackDirection;
  active?: boolean;
  onClose: () => void;
}

interface GestureHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  onTouchCancel: () => void;
  onClickCapture: (event: React.MouseEvent) => void;
}

export interface SwipeBackGesture {
  dragX: number;
  dragging: boolean;
  handlers: GestureHandlers;
}

/**
 * Follow-finger horizontal sheet dismissal. Vertical movement is left to the
 * sheet's normal scrolling; only the opposite of the entry direction moves it.
 */
export function useSwipeBackGesture({ direction, active = true, onClose }: Options): SwipeBackGesture {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'horizontal' | 'vertical' | null>(null);
  const offset = useRef(0);
  const closing = useRef(false);
  const didDrag = useRef(false);
  const closeTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!active) return;
    // This hook stays mounted while its sheet opens and closes. A completed
    // swipe-back must not leave the next opening permanently "closing".
    closing.current = false;
    start.current = null;
    axis.current = null;
    offset.current = 0;
    didDrag.current = false;
    setDragging(false);
    setDragX(0);
  }, [active]);

  const onTouchStart = useCallback((event: React.TouchEvent): void => {
    if (closing.current || event.touches.length !== 1) return;
    start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    axis.current = null;
    offset.current = 0;
    didDrag.current = false;
  }, []);

  const onTouchMove = useCallback((event: React.TouchEvent): void => {
    const from = start.current;
    if (!from || closing.current) return;
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (!axis.current) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (axis.current !== 'horizontal') return;
    if (Math.abs(dx) > 10) didDrag.current = true;
    const allowed = direction === 'right' ? Math.max(0, dx) : Math.min(0, dx);
    // Small rubber-band resistance when dragging the wrong way.
    const value = allowed === 0 ? dx * 0.08 : allowed;
    offset.current = value;
    setDragging(true);
    setDragX(value);
  }, [direction]);

  const finish = useCallback((): void => {
    const width = window.innerWidth;
    const threshold = Math.min(140, Math.max(84, width * 0.24));
    const travelled = Math.abs(offset.current);
    start.current = null;
    axis.current = null;
    setDragging(false);
    if (travelled >= threshold) {
      closing.current = true;
      setDragX((direction === 'right' ? 1 : -1) * width);
      closeTimer.current = window.setTimeout(onClose, 210);
      return;
    }
    offset.current = 0;
    setDragX(0);
  }, [direction, onClose]);

  const onTouchEnd = useCallback((): void => {
    if (!start.current) return;
    finish();
  }, [finish]);

  const onClickCapture = useCallback((event: React.MouseEvent): void => {
    if (!didDrag.current) return;
    event.preventDefault();
    event.stopPropagation();
    didDrag.current = false;
  }, []);

  const onTouchCancel = useCallback((): void => {
    start.current = null;
    axis.current = null;
    offset.current = 0;
    setDragging(false);
    setDragX(0);
  }, []);

  return {
    dragX,
    dragging,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onClickCapture },
  };
}
