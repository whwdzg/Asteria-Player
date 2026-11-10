import { ChevronDown24Regular } from '@fluentui/react-icons';
import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  icon?: ReactNode;
}

export function Select({ value, options, onChange, ariaLabel, className = '', icon }: SelectProps): React.ReactElement {
  return (
    <label className={`fluent-select ${className}`.trim()}>
      {icon ? <span className="select-icon" aria-hidden="true">{icon}</span> : null}
      <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown24Regular className="select-chevron" aria-hidden="true" />
    </label>
  );
}
