interface FlyerIconProps { size?: number; flying?: boolean; className?: string }

export function FlyerIcon({ size = 84, flying = false, className = '' }: FlyerIconProps) {
  return (
    <span className={`flyer-icon ${flying ? 'flyer-icon--flying' : ''} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <path className="flyer-shadow" d="M21 76c18 7 43 8 61-2-15 14-49 16-61 2Z" />
        <g className="flyer-paper">
          <path d="m20 25 61 11-13 43-57-15 9-39Z" />
          <path d="m20 25 31 28 30-17" />
          <path d="m11 64 39-12 18 27" />
          <path className="flyer-line" d="m31 40 32 6M27 49l21 5" />
        </g>
        <path className="wind wind--one" d="M8 19c14-8 23 3 35-4" />
        <path className="wind wind--two" d="M58 87c13-2 20-7 27-15" />
      </svg>
    </span>
  );
}
