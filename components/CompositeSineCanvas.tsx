import React, { useRef, useEffect } from 'react';

interface CompositeSineCanvasProps {
  className?: string;
  isStreaming?: boolean;
}

export const CompositeSineCanvas: React.FC<CompositeSineCanvasProps> = ({
  className = '',
  isStreaming = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Subtle background grid lines
      ctx.strokeStyle = 'rgba(51, 43, 35, 0.4)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x < width; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 12) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Center baseline
      ctx.strokeStyle = 'rgba(198, 147, 79, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw composite sine waves (harmonics)
      // Fundamental 1kHz, 3kHz harmonic, 5kHz harmonic
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = isStreaming ? '#7FD8B4' : '#C6934F';
      ctx.shadowColor = isStreaming ? 'rgba(127, 216, 180, 0.6)' : 'rgba(198, 147, 79, 0.5)';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      const speed = isStreaming ? 0.08 : 0.025;
      phase += speed;

      for (let x = 0; x < width; x++) {
        const normalizedX = (x / width) * Math.PI * 4;
        // Harmonic synthesis: f(x) = sin(x) + 0.35*sin(2x) + 0.15*sin(3x)
        const y1 = Math.sin(normalizedX + phase);
        const y2 = 0.35 * Math.sin(normalizedX * 2.2 - phase * 1.5);
        const y3 = 0.15 * Math.sin(normalizedX * 4.1 + phase * 0.8);

        const composite = (y1 + y2 + y3) / 1.5;
        const amplitude = (height / 2) * 0.65;
        const y = height / 2 + composite * amplitude;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Reset shadow for performance
      ctx.shadowBlur = 0;

      // Frequency tag
      ctx.fillStyle = '#9C8F7D';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(isStreaming ? 'LIVE FFT SIGNAL' : 'FR TRACE REF', 6, height - 6);

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isStreaming]);

  return (
    <div className={`relative rounded-xl border border-audio-border bg-[#100C09] overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={240}
        height={60}
        className="w-full h-[60px] block"
      />
    </div>
  );
};

export default CompositeSineCanvas;
