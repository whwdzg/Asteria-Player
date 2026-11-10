import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tooltip?: string;
  active?: boolean;
  variant?: 'ghost' | 'solid' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tooltip, active = false, variant = 'ghost', size = 'md', className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`icon-button ${variant} size-${size} ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-label={label}
      aria-pressed={props['aria-pressed']}
      data-tooltip={tooltip ?? label}
      {...props}
    >
      {children}
    </button>
  );
});
