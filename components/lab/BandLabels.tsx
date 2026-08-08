import React from 'react';
import { ViewportDimensions, freqToX } from '@/utils/curveSynthesizer';

interface BandLabelsProps {
  viewport: ViewportDimensions;
  minFreq?: number;
  maxFreq?: number;
}

const BANDS = [
  { name: 'SUB BASS', min: 20, max: 60, color: '#C6934F' },
  { name: 'MID BASS', min: 60, max: 250, color: '#D4A366' },
  { name: 'LOWER MID', min: 250, max: 500, color: '#A89988' },
  { name: 'UPPER MID', min: 500, max: 2000, color: '#6FC9A6' },
  { name: 'PRESENCE', min: 2000, max: 6000, color: '#4FB38B' },
  { name: 'MID TREBLE', min: 6000, max: 10000, color: '#E06A3F' },
  { name: 'AIR', min: 10000, max: 20000, color: '#7AA2E3' },
] as const;

export const BandLabels: React.FC<BandLabelsProps> = ({ viewport }) => {
  return (
    <g className="select-none pointer-events-none">
      {BANDS.map((band, idx) => {
        const x1 = Math.max(viewport.padding.left, freqToX(band.min, viewport));
        const x2 = Math.min(viewport.width - viewport.padding.right, freqToX(band.max, viewport));
        const width = x2 - x1;
        const centerX = x1 + width / 2;
        const yTop = viewport.height - viewport.padding.bottom;
        const yBottom = viewport.height - 4;

        if (width < 12) return null;

        return (
          <g key={band.name}>
            {/* Hairline boundary divider */}
            {idx > 0 && (
              <line
                x1={x1}
                y1={viewport.padding.top}
                x2={x1}
                y2={yBottom}
                stroke="#2A221B"
                strokeWidth="0.75"
                strokeDasharray="2 3"
                opacity="0.6"
              />
            )}

            {/* Subtle band floor marker */}
            <line
              x1={x1 + 2}
              y1={yTop + 1}
              x2={x2 - 2}
              y2={yTop + 1}
              stroke={band.color}
              strokeWidth="1.2"
              opacity="0.35"
            />

            {/* Engraved band text label */}
            {width > 34 && (
              <text
                x={centerX}
                y={yTop + 12}
                fill={band.color}
                fontSize={width < 60 ? '7' : '7.5'}
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="0.08em"
                textAnchor="middle"
                opacity="0.7"
              >
                {width < 45 ? band.name.split(' ')[0] : band.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};

export default BandLabels;
