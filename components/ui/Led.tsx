import React from 'react';

export type LedColor = 'green' | 'red' | 'amber' | 'brass' | 'teal' | 'muted';

interface LedProps {
  color?: LedColor;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  bootDelay?: number; // ms to stagger power-on sequencing
  className?: string;
}

export const Led: React.FC<LedProps> = ({
  color = 'green',
  pulse = false,
  size = 'md',
  label,
  bootDelay,
  className = '',
}) => {
  const colorStyles: Record<LedColor, { text: string; shadow: string }> = {
    green: {
      text: 'text-[#7FD8B4]',
      shadow: 'shadow-[0_0_10px_rgba(127,216,180,0.8),0_0_2px_#7FD8B4]',
    },
    teal: {
      text: 'text-[#6FC9A6]',
      shadow: 'shadow-[0_0_10px_rgba(111,201,166,0.8),0_0_2px_#6FC9A6]',
    },
    red: {
      text: 'text-[#E06A3F]',
      shadow: 'shadow-[0_0_10px_rgba(224,106,63,0.8),0_0_2px_#E06A3F]',
    },
    amber: {
      text: 'text-[#D97748]',
      shadow: 'shadow-[0_0_10px_rgba(217,119,72,0.8),0_0_2px_#D97748]',
    },
    brass: {
      text: 'text-[#C6934F]',
      shadow: 'shadow-[0_0_10px_rgba(198,147,79,0.8),0_0_2px_#C6934F]',
    },
    muted: {
      text: 'text-[#4A3E33]',
      shadow: 'shadow-none',
    },
  };

  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];

  const current = colorStyles[color];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`rounded-full bg-currentColor flex-shrink-0 ${sizeClasses} ${current.text} ${current.shadow} ${
          pulse ? 'animate-led-pulse' : ''
        } ${bootDelay !== undefined ? 'animate-boot-led' : ''}`}
        style={{
          backgroundColor: 'currentColor',
          ...(bootDelay !== undefined ? { animationDelay: `${bootDelay}ms` } : {}),
        }}
      />
      {label && (
        <span className="font-data text-[10px] tracking-wider uppercase text-audio-muted select-none">
          {label}
        </span>
      )}
    </span>
  );
};

export default Led;
