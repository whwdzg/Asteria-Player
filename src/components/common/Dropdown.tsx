import { Checkmark24Regular, ChevronDown24Regular } from '@fluentui/react-icons';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useOverlayRoot } from '../../hooks/useOverlayRoot';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  icon?: ReactNode;
  menuLabel?: string;
}

/** A Fluent listbox that portals out of scroll containers such as settings. */
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  icon,
  menuLabel,
}: DropdownProps): React.ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const root = useOverlayRoot();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 188);
    const height = panel.getBoundingClientRect().height;
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPosition({ top, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    const close = (): void => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    // Capture so the surrounding settings popover does not also close.
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedButton = panelRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    const first = selectedButton ?? panelRef.current?.querySelector<HTMLButtonElement>('button');
    first?.focus({ preventScroll: true });
  }, [open]);

  const moveFocus = (delta: number): void => {
    const buttons = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (index + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const choose = (next: DropdownOption): void => {
    if (next.disabled) return;
    onChange(next.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`fluent-select ${className}`.trim()}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {icon ? <span className="select-icon" aria-hidden="true">{icon}</span> : null}
        <span className="select-value">{selected?.label ?? value}</span>
        <ChevronDown24Regular className="select-chevron" aria-hidden="true" />
      </button>
      {open ? createPortal(
        <div
          ref={panelRef}
          className="fluent-dropdown"
          role="listbox"
          aria-label={menuLabel ?? ariaLabel}
          style={{ top: position.top, left: position.left, width: position.width }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(1); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-1); }
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              className={`dropdown-option ${option.value === value ? 'is-selected' : ''}`.trim()}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span>
              {option.value === value ? <Checkmark24Regular aria-hidden="true" /> : null}
            </button>
          ))}
        </div>,
        root,
      ) : null}
    </>
  );
}
