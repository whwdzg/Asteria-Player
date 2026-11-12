import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Checkmark24Regular, ChevronLeft24Regular, ChevronRight24Regular } from '@fluentui/react-icons';
import { useOverlayRoot } from '../../hooks/useOverlayRoot';

export interface MenuAnchor {
  rect: DOMRect;
  element: HTMLElement;
}

export interface MenuItemDef {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  submenu?: MenuItemDef[];
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  heading?: boolean;
  separator?: boolean;
}

interface MenuProps {
  open: boolean;
  anchor: MenuAnchor | null;
  items: MenuItemDef[];
  onClose: () => void;
  label?: string;
  width?: number;
}

const MENU_MARGIN = 8;

export function Menu({ open, anchor, items, onClose, label, width = 232 }: MenuProps): React.ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const root = useOverlayRoot();
  const [stack, setStack] = useState<Array<{ label: string; items: MenuItemDef[] }>>([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const activeItems = stack.length ? stack[stack.length - 1].items : items;

  useEffect(() => {
    if (!open) setStack([]);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const update = (): void => {
      const panel = panelRef.current;
      const height = panel?.getBoundingClientRect().height ?? activeItems.length * 40 + 16;
      const rect = anchor.rect;
      let top = rect.bottom + 8;
      if (top + height > window.innerHeight - MENU_MARGIN) {
        top = Math.max(MENU_MARGIN, rect.top - height - 8);
      }
      const left = Math.min(
        Math.max(MENU_MARGIN, rect.right - width),
        window.innerWidth - width - MENU_MARGIN,
      );
      setPosition((current) => (current.top === top && current.left === left ? current : { top, left }));
    };
    update();
    const panel = panelRef.current;
    const observer = panel ? new ResizeObserver(update) : null;
    if (panel && observer) observer.observe(panel);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [open, anchor, activeItems.length, width]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (anchor?.element.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (stack.length) setStack((current) => current.slice(0, -1));
        else onClose();
      }
    };
    const onScroll = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onClose, anchor, stack.length]);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not([disabled])');
    first?.focus({ preventScroll: true });
  }, [open, stack.length]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fluent-menu"
      role="menu"
      aria-label={label}
      style={{ top: position.top, left: position.left, width }}
    >
      {stack.length ? (
        <button
          type="button"
          className="menu-back"
          onClick={() => setStack((current) => current.slice(0, -1))}
        >
          <ChevronLeft24Regular />
          <span>{stack[stack.length - 1].label}</span>
        </button>
      ) : null}
      {activeItems.map((item) => {
        if (item.separator) return <div key={item.id} className="menu-separator" role="separator" />;
        if (item.heading) return <div key={item.id} className="menu-heading">{item.label}</div>;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`menu-item ${item.danger ? 'danger' : ''}`.trim()}
            disabled={item.disabled}
            onClick={() => {
              if (item.submenu) {
                setStack((current) => [...current, { label: item.label, items: item.submenu! }]);
                return;
              }
              onClose();
              item.onSelect?.();
            }}
          >
            <span className="menu-icon" aria-hidden="true">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
            {item.checked ? <Checkmark24Regular className="menu-check" aria-hidden="true" /> : null}
            {item.submenu ? <ChevronRight24Regular className="menu-chevron" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>,
    root,
  );
}
