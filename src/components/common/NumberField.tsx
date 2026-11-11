import { useEffect, useRef, useState } from 'react';

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  ariaLabel: string;
  onChange: (value: number) => void;
  className?: string;
  decimals?: number;
}

export function NumberField({
  value,
  min,
  max,
  step = 1,
  suffix,
  ariaLabel,
  onChange,
  className = '',
  decimals = 0,
}: NumberFieldProps): React.ReactElement {
  const [draft, setDraft] = useState(String(Number(value.toFixed(decimals))));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(Number(value.toFixed(decimals))));
  }, [value, decimals]);

  const commit = (raw: string): void => {
    const parsed = Number(raw);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    onChange(next);
    setDraft(String(Number(next.toFixed(decimals))));
  };

  return (
    <span className={`number-field ${className}`.trim()}>
      <input
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onFocus={(event) => {
          focused.current = true;
          event.currentTarget.select();
        }}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          setDraft(raw);
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
        }}
        onBlur={(event) => {
          focused.current = false;
          commit(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
      {suffix ? <span className="number-suffix" aria-hidden="true">{suffix}</span> : null}
    </span>
  );
}
