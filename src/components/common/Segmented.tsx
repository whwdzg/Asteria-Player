import type { ReactNode } from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  size = 'md',
}: SegmentedProps<T>): React.ReactElement {
  return (
    <div className={`segmented size-${size} ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segment ${option.value === value ? 'is-selected' : ''}`.trim()}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
