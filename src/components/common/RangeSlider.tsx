import type { CSSProperties } from 'react';

interface RangeSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  ariaValueText?: string;
}

export function RangeSlider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  ariaLabel,
  className = '',
  disabled = false,
  ariaValueText,
}: RangeSliderProps): React.ReactElement {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className={`range-slider ${className}`.trim()}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      style={{ '--range-fill': `${Math.min(100, Math.max(0, percent))}%` } as CSSProperties}
    />
  );
}
