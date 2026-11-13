interface BlurredBackdropProps {
  cover?: string;
  className?: string;
}

/** A reusable cover-art blur matching the main now-playing ambient layer. */
export function BlurredBackdrop({ cover, className = '' }: BlurredBackdropProps): React.ReactElement {
  return (
    <div className={`blurred-backdrop ${className}`.trim()} aria-hidden="true">
      {cover ? <div className="blurred-backdrop-cover" style={{ backgroundImage: `url("${cover}")` }} /> : null}
      <div className="blurred-backdrop-scrim" />
    </div>
  );
}
