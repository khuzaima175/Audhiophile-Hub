import React, { useState, useEffect } from 'react';

interface StatDialProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  subtext?: string;
  accent?: 'brass' | 'teal' | 'warn' | 'default';
  onClick?: () => void;
  className?: string;
}

export const StatDial: React.FC<StatDialProps> = ({
  label,
  value,
  suffix = '',
  prefix = '',
  subtext,
  accent = 'brass',
  onClick,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200; // ms
    const startVal = 0;
    const targetVal = value;

    if (targetVal === 0) {
      setDisplayValue(0);
      return;
    }

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (targetVal - startVal) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animFrame);
  }, [value]);

  // Rule: numbers cream at zero, brass when non-zero; teal reserved strictly for LEDs
  const isZero = displayValue === 0;
  const numberColorClass = isZero
    ? 'text-[#EDE6DA]/70 font-semibold'
    : accent === 'warn'
    ? 'text-audio-warn text-shadow-[0_0_12px_rgba(217,119,72,0.35)] font-bold'
    : 'text-audio-accent text-shadow-[0_0_12px_rgba(198,147,79,0.35)] font-bold';

  return (
    <div
      onClick={onClick}
      className={`panel-interactive p-3.5 rounded-xl border border-audio-border bg-gradient-to-b from-[#1C1713] to-[#14100D] flex flex-col justify-between select-none transition-all ${
        onClick ? 'cursor-pointer hover:border-audio-accent/60' : ''
      } ${className}`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-audio-muted">
          {label}
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            isZero ? 'bg-audio-muted/30' : 'bg-audio-accent shadow-[0_0_6px_#C6934F]'
          }`}
        />
      </div>

      <div className="flex items-baseline gap-1 my-1">
        {prefix && <span className="font-mono text-xs text-audio-muted">{prefix}</span>}
        <span className={`font-display text-2xl md:text-3xl tracking-tight transition-colors ${numberColorClass}`}>
          {displayValue}
        </span>
        {suffix && <span className="font-mono text-xs text-audio-muted">{suffix}</span>}
      </div>

      {subtext && (
        <div className="text-[9.5px] font-mono text-audio-muted/80 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};

export default StatDial;
