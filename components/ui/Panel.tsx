import React from 'react';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'sunken' | 'brass-framed';
  brushed?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  variant = 'default',
  brushed = false,
  className = '',
  children,
  ...props
}) => {
  const variantClasses = {
    default: 'panel',
    interactive: 'panel-interactive cursor-pointer',
    sunken: 'rounded-xl border border-audio-border/80 bg-[#120D0A] shadow-inner',
    'brass-framed': 'panel border-audio-accent/40 shadow-glow-brass',
  }[variant];

  return (
    <div
      className={`${variantClasses} ${brushed ? 'brushed' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Panel;
