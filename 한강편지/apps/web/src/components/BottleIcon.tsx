interface BottleIconProps {
  size?: number;
  glowing?: boolean;
}

export function BottleIcon({ size = 92, glowing = false }: BottleIconProps) {
  return (
    <div className={glowing ? 'bottle-wrap bottle-wrap--glow' : 'bottle-wrap'} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" role="img" aria-label="편지가 담긴 병">
        <defs>
          <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#DFF8F4" stopOpacity="0.9" />
            <stop offset="1" stopColor="#72B8B0" stopOpacity="0.55" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#184B58" floodOpacity="0.2" />
          </filter>
        </defs>
        <g transform="rotate(-8 60 60)" filter="url(#shadow)">
          <path d="M47 18h26v14l8 9c5 6 8 13 8 21v30c0 9-7 16-16 16H47c-9 0-16-7-16-16V62c0-8 3-15 8-21l8-9V18Z" fill="url(#glass)" stroke="#2B7276" strokeWidth="3" />
          <path d="M46 18h28v10H46z" rx="3" fill="#B98555" stroke="#7F5938" strokeWidth="2" />
          <path d="M40 67c13 6 27 6 41 0v27c0 4-3 7-7 7H47c-4 0-7-3-7-7V67Z" fill="#BDE5DD" opacity="0.55" />
          <g transform="translate(43 56) rotate(5 18 15)">
            <rect x="0" y="3" width="36" height="25" rx="3" fill="#FFF9E9" stroke="#D4B87C" strokeWidth="2" />
            <path d="m2 6 16 12L34 6" fill="none" stroke="#D4B87C" strokeWidth="2" />
          </g>
          <path d="M41 46c6-8 12-10 18-10" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
