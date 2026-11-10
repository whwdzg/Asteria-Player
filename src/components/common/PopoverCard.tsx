import type { ReactNode } from 'react';

interface PopoverCardProps {
  children: ReactNode;
  className?: string;
  label?: string;
  id?: string;
}

export function PopoverCard({ children, className = '', label, id }: PopoverCardProps): React.ReactElement {
  return (
    <div
      className={`popover-card ${className}`.trim()}
      role="dialog"
      aria-label={label}
      id={id}
    >
      <span className="popover-sheen" aria-hidden="true" />
      {children}
    </div>
  );
}
