import React from 'react';

interface EngravedProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
  glow?: boolean;
  className?: string;
}

export const Engraved: React.FC<EngravedProps> = ({
  children,
  size = 'sm',
  glow = false,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    xs: 'text-[9px] tracking-[0.14em]',
    sm: 'text-[10px] tracking-[0.18em]',
    md: 'text-[11px] tracking-[0.20em]',
  }[size];

  return (
    <span
      className={`font-mono uppercase select-none text-[#9C8F7D] ${sizeClasses} ${
        glow ? 'text-audio-accent text-shadow-[0_0_8px_rgba(198,147,79,0.4)]' : ''
      } ${className}`}
      style={{
        textShadow: glow ? '0 0 8px rgba(198,147,79,0.4)' : '0 1px 0 rgba(0,0,0,0.8)',
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export default Engraved;
