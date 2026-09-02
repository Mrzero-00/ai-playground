import type { Park } from '../types';

interface RiverMapProps {
  parks: Park[];
  selectedId: string | null;
  onSelect: (park: Park) => void;
}

const positions: Record<string, { x: number; y: number; labelX: number; labelY: number }> = {
  mangwon: { x: 53, y: 95, labelX: 26, labelY: 79 },
  yeouido: { x: 132, y: 122, labelX: 103, labelY: 151 },
  banpo: { x: 224, y: 93, labelX: 200, labelY: 73 },
  ttukseom: { x: 318, y: 124, labelX: 287, labelY: 153 },
  jamsil: { x: 391, y: 86, labelX: 365, labelY: 65 },
};

export function RiverMap({ parks, selectedId, onSelect }: RiverMapProps) {
  return (
    <div className="river-map" aria-label="한강공원별 편지 현황">
      <svg viewBox="0 0 440 210" role="img">
        <defs>
          <linearGradient id="river" x1="0" x2="1">
            <stop offset="0" stopColor="#B9DCEB" />
            <stop offset="0.52" stopColor="#9CCFE3" />
            <stop offset="1" stopColor="#C2E3EC" />
          </linearGradient>
          <filter id="mapShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#2F6480" floodOpacity="0.18" />
          </filter>
        </defs>
        <path d="M-10 72C65 31 116 67 170 72s91-11 143-31 89 2 145 10v111c-67-13-106-35-166-10s-110 29-165 4S44 130-10 148Z" fill="url(#river)" />
        <path d="M3 85c73-30 116-3 172 2s90-10 139-27 83-1 122 5" fill="none" stroke="#E9F7FB" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
        <path d="M24 167c78-19 106 22 179 5s116-45 211-7" fill="none" stroke="#77A9BD" strokeDasharray="3 9" strokeLinecap="round" opacity="0.45" />
        {parks.map((park) => {
          const position = positions[park.id];
          if (!position) return null;
          const selected = selectedId === park.id;
          return (
            <g
              key={park.id}
              className={selected ? 'map-marker map-marker--selected' : 'map-marker'}
              role="button"
              tabIndex={0}
              aria-label={`${park.name}, 편지 ${park.inventoryCount}개`}
              onClick={() => onSelect(park)}
              onKeyDown={(event) => event.key === 'Enter' && onSelect(park)}
            >
              {selected && <circle cx={position.x} cy={position.y} r="24" fill={park.accent} opacity="0.16" />}
              <circle cx={position.x} cy={position.y} r="15" fill="#FFF" filter="url(#mapShadow)" />
              <circle cx={position.x} cy={position.y} r="11" fill={park.inventoryCount ? park.accent : '#AAB7C4'} />
              <text x={position.x} y={position.y + 4} textAnchor="middle" fill="#FFF" fontSize="11" fontWeight="800">
                {park.inventoryCount}
              </text>
              <text x={position.labelX} y={position.labelY} fill="#3E5568" fontSize="10" fontWeight={selected ? '800' : '600'}>
                {park.name.replace('한강공원', '')}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="river-map__legend"><span /> 숫자는 공원에 도착한 편지 수예요</div>
    </div>
  );
}
