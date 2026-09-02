import type { Region } from '../types';

interface RegionGridProps {
  regions: Region[];
  selectedId: string | null;
  onSelect: (region: Region) => void;
}

export function RegionGrid({ regions, selectedId, onSelect }: RegionGridProps) {
  return (
    <div className="region-grid" aria-label="구별 삐라 현황">
      {regions.map((region, index) => (
        <button
          key={region.id}
          className={selectedId === region.id ? 'region-tile region-tile--selected' : 'region-tile'}
          style={{ '--region-accent': region.accent, '--tile-delay': `${index * 45}ms` } as React.CSSProperties}
          onClick={() => onSelect(region)}
        >
          <span className="region-tile__paper">▧</span>
          <span><strong>{region.district}</strong><small>{region.inventoryCount}장 내려앉음</small></span>
          <b>{region.inventoryCount}</b>
        </button>
      ))}
    </div>
  );
}
