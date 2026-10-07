import React from 'react';

interface FaderProps {
  label: string;
  value: number; // e.g. -12 to +12, or 0 to 100
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  orientation?: 'horizontal' | 'vertical';
  ticks?: (string | number)[];
  className?: string;
}

export const Fader: React.FC<FaderProps> = ({
  label,
  value,
  min = -10,
  max = 10,
  step = 0.5,
  unit = 'dB',
  onChange,
  orientation = 'horizontal',
  ticks = ['-10', '-5', '0', '+5', '+10'],
  className = '',
}) => {
  const zeroPercentage = (0 - min) / (max - min) * 100;
  const tickPercentage = (tick: string | number) => (parseFloat(String(tick)) - min) / (max - min) * 100;
  const percentage = ((value - min) / (max - min)) * 100;

  if (orientation === 'vertical') {
    return (
      <div className={`flex flex-col items-center select-none py-2 px-1 ${className}`}>
        <span className="font-mono text-[9px] uppercase tracking-wider text-audio-muted mb-2">
          {label}
        </span>
        <div className="relative h-36 w-8 flex justify-center items-center">
          {/* Calibrated Tick Marks on Left */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[7px] font-mono text-audio-muted/60">
            {ticks.map((t, i) => (
              <span key={i} className="absolute leading-none" style={{ bottom: `${tickPercentage(t)}%` }}>{t}</span>
            ))}
          </div>

          {/* Fader Slot (Brushed sunken rail) */}
          <div className="w-1.5 h-full rounded-full bg-audio-surface border border-audio-border shadow-inner relative mx-auto">
            {/* Center Zero line mark */}
            <div className="absolute left-[-4px] right-[-4px] h-[1px] bg-audio-accent/50" style={{ bottom: `${zeroPercentage}%` }} />
          </div>

          {/* Actual Input */}
          <input
            aria-label={label}
          type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-ns-resize h-full w-full z-20"
            style={{ appearance: 'slider-vertical' as any }}
          />

          {/* Tactile Hardware Thumb Knob */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-6 h-4 rounded-[3px] border border-audio-border bg-gradient-to-b from-audio-highlight via-audio-surface to-audio-base shadow-[0_2px_8px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(237,230,218,0.2)] pointer-events-none z-10 flex items-center justify-center transition-transform duration-75"
            style={{
              bottom: `calc(${percentage}% - 8px)`,
            }}
          >
            {/* Center brass engraved indicator line */}
            <div className="w-3.5 h-[1.5px] bg-audio-accent rounded-full shadow-[0_0_4px_rgba(198,147,79,0.8)]" />
          </div>
        </div>

        {/* Readout */}
        <span className="font-mono text-[10px] text-audio-accent font-bold mt-2">
          {value > 0 ? `+${value}` : value}
          <span className="text-[8px] text-audio-muted font-normal ml-0.5">{unit}</span>
        </span>
      </div>
    );
  }

  // Horizontal Fader
  return (
    <div className={`select-none w-full ${className}`}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-audio-muted">
          {label}
        </span>
        <span className="font-mono text-xs text-audio-accent font-bold">
          {value > 0 ? `+${value}` : value} {unit}
        </span>
      </div>

      <div className="relative py-2 flex items-center">
        {/* Fader Slot (Sunken track) */}
        <div className="w-full h-2 rounded-full bg-audio-surface border border-audio-border shadow-inner relative">
          {/* Active fill up to thumb */}
          <div
            className="h-full bg-gradient-to-r from-audio-accent/40 to-audio-accent rounded-full opacity-60"
            style={{ width: `${percentage}%` }}
          />
          {/* Center 0 mark */}
          <div className="absolute top-[-2px] bottom-[-2px] w-[1.5px] bg-audio-accent/50" style={{ left: `${zeroPercentage}%` }} />
        </div>

        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-ew-resize z-20"
        />

        {/* Hardware Knob */}
        <div
          className="absolute w-4 h-6 rounded-[3px] border border-audio-border bg-gradient-to-b from-audio-highlight via-audio-surface to-audio-base shadow-[0_2px_8px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(237,230,218,0.2)] pointer-events-none z-10 -translate-x-1/2 flex items-center justify-center"
          style={{ left: `${percentage}%` }}
        >
          <div className="h-3 w-[1.5px] bg-audio-accent rounded-full shadow-[0_0_4px_rgba(198,147,79,0.8)]" />
        </div>
      </div>

      {/* Ticks */}
      <div className="relative h-4 text-[8px] font-mono text-audio-muted mt-0.5">
        {ticks.map((t, i) => (
          <span key={i} className="absolute" style={{ left: `${tickPercentage(t)}%`, transform: 'translateX(-50%)' }}>{t}</span>
        ))}
      </div>
    </div>
  );
};

export default Fader;
