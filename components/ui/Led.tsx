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
      text: 'text-[#a1d8b1]',
      shadow: 'shadow-[0_0_10px_rgba(127,216,180,0.8),0_0_2px_#a1d8b1]',
    },
    teal: {
      text: 'text-[#83bfa5]',
      shadow: 'shadow-[0_0_10px_rgba(111,201,166,0.8),0_0_2px_#83bfa5]',
    },
    red: {
      text: 'text-[#eb9689]',
      shadow: 'shadow-[0_0_10px_rgba(224,106,63,0.8),0_0_2px_#eb9689]',
    },
    amber: {
      text: 'text-[#e6a18b]',
      shadow: 'shadow-[0_0_10px_rgba(217,119,72,0.8),0_0_2px_#e6a18b]',
    },
    brass: {
      text: 'text-[#b4e4bd]',
      shadow: 'shadow-[0_0_10px_rgba(198,147,79,0.8),0_0_2px_#b4e4bd]',
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
