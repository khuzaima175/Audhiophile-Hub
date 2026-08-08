import React, { useState, useEffect } from 'react';

interface VUMeterProps {
  label?: string;
  sublabel?: string;
  isLive?: boolean;
  value?: number; // 0 to 100 percentage or dB level
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VUMeter: React.FC<VUMeterProps> = ({
  label = 'SIGNAL',
  sublabel = 'VU LEVEL',
  isLive = true,
  value,
  size = 'md',
  className = '',
}) => {
  const [isBooted, setIsBooted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooted(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  const dimensions = {
    sm: { width: 140, height: 75, needleOrigin: '70,70', length: 52 },
    md: { width: 180, height: 95, needleOrigin: '90,90', length: 68 },
    lg: { width: 220, height: 115, needleOrigin: '110,110', length: 84 },
  }[size];

  // If a specific value is passed, map 0-100 to -45deg to +45deg; otherwise use idle sway animation
  const staticRotation = value !== undefined ? -45 + (Math.min(100, Math.max(0, value)) / 100) * 90 : null;

  return (
    <div
      className={`relative rounded-xl border border-audio-border bg-[#130E0B] p-2.5 shadow-panel overflow-hidden flex flex-col items-center ${className}`}
      style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 120%, rgba(198,147,79,0.18) 0%, rgba(20,16,13,0.95) 75%)',
      }}
    >
      {/* Screw dots in corners for authentic hardware aesthetic */}
      <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#332B23] border border-[#1A1512] shadow-inner" />
      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#332B23] border border-[#1A1512] shadow-inner" />

      {/* Header labels */}
      <div className="w-full flex justify-between items-center px-1 text-[8px] font-mono text-audio-muted tracking-widest uppercase">
        <span className="text-[#C6934F]/80 font-bold">{label}</span>
        <span className="text-[7px] text-[#7FD8B4] flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[#7FD8B4] animate-pulse" />
          -20dB → +3dB
        </span>
      </div>

      {/* SVG Dial */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="overflow-visible select-none my-1"
      >
        <defs>
          <linearGradient id={`vu-arc-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7FD8B4" />
            <stop offset="70%" stopColor="#C6934F" />
            <stop offset="100%" stopColor="#E06A3F" />
          </linearGradient>
          <filter id={`needle-glow-${size}`} x1="-20%" y1="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Dial Scale Arc */}
        <path
          d={`M ${dimensions.width * 0.15} ${dimensions.height * 0.88} A ${dimensions.width * 0.42} ${dimensions.height * 0.78} 0 0 1 ${dimensions.width * 0.85} ${dimensions.height * 0.88}`}
          fill="none"
          stroke={`url(#vu-arc-grad-${size})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Tick marks */}
        {[-38, -26, -14, 0, 14, 26, 38].map((angle, i) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          const cx = dimensions.width / 2;
          const cy = dimensions.height * 0.95;
          const rInner = dimensions.height * 0.65;
          const rOuter = dimensions.height * 0.78;
          const x1 = cx + rInner * Math.cos(rad);
          const y1 = cy + rInner * Math.sin(rad);
          const x2 = cx + rOuter * Math.cos(rad);
          const y2 = cy + rOuter * Math.sin(rad);
          const isRed = angle > 20;

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isRed ? '#E06A3F' : '#9C8F7D'}
              strokeWidth={i % 2 === 0 ? '1.5' : '1'}
              opacity={i % 2 === 0 ? 0.9 : 0.6}
            />
          );
        })}

        {/* dB scale markings */}
        <text x={dimensions.width * 0.18} y={dimensions.height * 0.6} fill="#7FD8B4" fontSize="7" fontFamily="monospace" textAnchor="middle">-20</text>
        <text x={dimensions.width * 0.35} y={dimensions.height * 0.42} fill="#9C8F7D" fontSize="7" fontFamily="monospace" textAnchor="middle">-7</text>
        <text x={dimensions.width * 0.5} y={dimensions.height * 0.36} fill="#C6934F" fontSize="7.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">0</text>
        <text x={dimensions.width * 0.65} y={dimensions.height * 0.42} fill="#D97748" fontSize="7" fontFamily="monospace" textAnchor="middle">+2</text>
        <text x={dimensions.width * 0.82} y={dimensions.height * 0.6} fill="#E06A3F" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">+3</text>

        {/* Needle Line */}
        <g
          style={{
            transformOrigin: `${dimensions.width / 2}px ${dimensions.height * 0.92}px`,
            transform: staticRotation !== null ? `rotate(${staticRotation}deg)` : undefined,
            animation: isLive && staticRotation === null
              ? (isBooted ? 'needle-sway 3.6s ease-in-out infinite' : 'needle-boot-sweep 1.4s cubic-bezier(0.25, 1, 0.5, 1)')
              : undefined,
            transition: 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        >
          {/* Main Needle Blade */}
          <line
            x1={dimensions.width / 2}
            y1={dimensions.height * 0.92}
            x2={dimensions.width / 2}
            y2={dimensions.height * 0.15}
            stroke="#EDE6DA"
            strokeWidth="1.5"
            strokeLinecap="round"
            filter={`url(#needle-glow-${size})`}
          />
          {/* Tip color highlight */}
          <line
            x1={dimensions.width / 2}
            y1={dimensions.height * 0.28}
            x2={dimensions.width / 2}
            y2={dimensions.height * 0.15}
            stroke="#E06A3F"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>

        {/* Pivot Center Knob */}
        <circle
          cx={dimensions.width / 2}
          cy={dimensions.height * 0.92}
          r="6"
          fill="#241E19"
          stroke="#C6934F"
          strokeWidth="1.5"
        />
        <circle
          cx={dimensions.width / 2}
          cy={dimensions.height * 0.92}
          r="2.5"
          fill="#C6934F"
        />
      </svg>

      <div className="text-[7.5px] font-mono text-audio-muted/80 tracking-widest uppercase mt-0.5">
        {sublabel}
      </div>
    </div>
  );
};

export default VUMeter;
