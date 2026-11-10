interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`fluent-switch ${checked ? 'is-on' : ''}`.trim()}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
    </button>
  );
}
