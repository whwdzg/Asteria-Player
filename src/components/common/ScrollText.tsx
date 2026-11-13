import { useEffect, useRef, useState } from 'react';

interface ScrollTextProps {
  text: string;
  className?: string;
}

/**
 * Single-line label that becomes a seamless marquee only when the text does
 * not fit. Used for track headings everywhere instead of ellipsis.
 */
export function ScrollText({ text, className = '' }: ScrollTextProps): React.ReactElement {
  const outerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const element = outerRef.current;
    if (!element) return;
    const measure = (): void => setOverflow(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  const duration = `${Math.max(9, Math.min(26, text.length * 0.42))}s`;

  return (
    <span
      ref={outerRef}
      className={`scroll-text ${overflow ? 'is-overflow' : ''} ${className}`.trim()}
      title={text}
    >
      <span
        className="scroll-text-inner"
        style={{ '--scroll-duration': duration } as React.CSSProperties}
      >
        <span>{text}</span>
        {overflow ? <span className="scroll-text-ghost" aria-hidden="true">{text}</span> : null}
      </span>
    </span>
  );
}
