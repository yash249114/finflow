"use client";

import React, { useRef, useEffect, useState } from 'react';

interface FinancialEnergyFieldsProps {
  className?: string;
  intensity?: number;
  isActive?: boolean;
}

export function FinancialEnergyFields({
  className = '',
  isActive = true,
}: FinancialEnergyFieldsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const financialDataRef = useRef({
    cashFlow: 0,
    riskScore: 0,
    forecastConfidence: 0,
    aiActivity: 0,
    systemHealth: 0,
  });

  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const dpr = window.devicePixelRatio;
    const financialGradient = ctx.createLinearGradient(0, 0, 0, canvas.height / dpr);
    financialGradient.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
    financialGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.05)');
    financialGradient.addColorStop(1, 'rgba(236, 72, 153, 0.1)');

    const riskGradient = ctx.createLinearGradient(0, 0, canvas.width / dpr, 0);
    riskGradient.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
    riskGradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.05)');
    riskGradient.addColorStop(1, 'rgba(99, 102, 241, 0.08)');

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
      type: 'positive' | 'neutral' | 'negative';

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5 - 0.1;
        this.life = 0;
        this.maxLife = 200 + Math.random() * 300;
        this.size = Math.random() * 2 + 0.5;
        this.type = Math.random() > 0.5 ? 'positive' : Math.random() > 0.6 ? 'negative' : 'neutral';
        this.color = this.type === 'positive' ? 'rgba(16, 185, 129, 0.8)' :
                    this.type === 'negative' ? 'rgba(239, 68, 68, 0.8)' :
                    'rgba(99, 102, 241, 0.6)';
      }

      update(cashFlow: number, riskScore: number) {
        this.life++;

        const flowInfluence = cashFlow > 0 ? 0.02 : -0.02;
        const riskInfluence = riskScore * 0.01;

        this.vx += flowInfluence * Math.cos(this.x * 0.01);
        this.vy += flowInfluence * Math.sin(this.x * 0.01) + riskInfluence;
        this.vy += 0.01;

        this.x += this.vx;
        this.y += this.vy;

        const c = canvas!;
        const dpr = window.devicePixelRatio;
        if (this.y < 0 || this.y > c.height / dpr) {
          this.y = Math.max(0, Math.min(this.y, c.height / dpr));
          this.vy *= -0.5;
        }

        if (this.x < 0 || this.x > c.width / dpr) {
          this.x = Math.max(0, Math.min(this.x, c.width / dpr));
          this.vx *= -0.5;
        }
      }

      draw(ctx: CanvasRenderingContext2D, waveOffset: number) {
        const alpha = 1 - (this.life / this.maxLife);
        const pulseSize = 1 + Math.sin(this.life * 0.05 + waveOffset) * 0.3;
        const currentSize = this.size * pulseSize;

        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = this.color;

        const glowSize = currentSize * 3;
        ctx.shadowBlur = glowSize;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const particles: Particle[] = [];
    const gridPoints: { x: number; y: number; value: number }[] = [];
    const gridResolution = 20;
    const cellSize = canvas.width / dpr / gridResolution;

    const initGrid = () => {

      for (let i = 0; i <= gridResolution; i++) {
        for (let j = 0; j <= gridResolution; j++) {
          gridPoints.push({
            x: i * cellSize,
            y: j * cellSize,
            value: Math.random() * 0.5 + 0.5,
          });
        }
      }
    };

    const drawGridFlow = (waveOffset: number) => {
      const gradientStep = 0.002;

      gridPoints.forEach((point) => {
        ctx.save();

        const waveX = point.x * gradientStep + waveOffset;
        const waveY = point.y * gradientStep + waveOffset * 0.7;
        const waveValue = Math.sin(waveX) * Math.cos(waveY) * 0.5 + 0.5;

        const heatValue = point.value * waveValue;

        const r = 16 + heatValue * 100;
        const g = 182 + heatValue * 50;
        const b = 129 + heatValue * 80;
        const alpha = heatValue * 0.1;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

        const size = cellSize * (0.5 + heatValue * 2);

        ctx.shadowBlur = size * 2;
        ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;

        ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        ctx.restore();
      });
    };

    const drawFlowLines = (waveOffset: number) => {
      ctx.save();
      ctx.globalAlpha = 0.3;

      gridPoints.forEach((point, index) => {
        if (index % 3 !== 0) return;

        const nextPoint = gridPoints[Math.min(index + Math.floor(Math.random() * 5) + 1, gridPoints.length - 1)];
        if (!nextPoint) return;

        const lineGradient = ctx.createLinearGradient(point.x, point.y, nextPoint.x, nextPoint.y);
        lineGradient.addColorStop(0, 'rgba(16, 185, 129, 0)');
        lineGradient.addColorStop(0.5, `rgba(99, 102, 241, ${0.2 * (1 - waveOffset / Math.PI)})`);
        lineGradient.addColorStop(1, 'rgba(236, 72, 153, 0)');

        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 0.5 + financialDataRef.current.riskScore * 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';

        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(nextPoint.x, nextPoint.y);
        ctx.stroke();
      });

      ctx.restore();
    };

    const animate = () => {
      if (isPaused) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const waveOffset = timeRef.current * 0.001;

      drawGridFlow(waveOffset);
      drawFlowLines(waveOffset);

      particles.forEach((particle, index) => {
        particle.update(financialDataRef.current.cashFlow, financialDataRef.current.riskScore);
        particle.draw(ctx, waveOffset);

        if (particle.life >= particle.maxLife) {
          particles.splice(index, 1);
        }
      });

      if (Math.random() < 0.02) {
        const x = Math.random() * canvas.width / dpr;
        const y = canvas.height / dpr - Math.random() * 50;
        particles.push(new Particle(x, y));
      }

      timeRef.current += 16;

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      particles.push(new Particle(e.clientX, e.clientY));
    };

    const handleFinancialUpdate = (event: CustomEvent) => {
      financialDataRef.current = event.detail;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('financial-update', handleFinancialUpdate as EventListener);
    window.addEventListener('resize', resizeCanvas);

    resizeCanvas();
    initGrid();
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('financial-update', handleFinancialUpdate as EventListener);
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}
         onMouseEnter={() => setIsPaused(false)}
         onMouseLeave={() => setIsPaused(true)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.5s ease' }}
      />
      <div className="absolute bottom-4 left-4 text-white/40 text-xs pointer-events-none">
        FinFlow Financial Energy Fields
        <div className="text-white/20 text-[10px] mt-1">
          Press SPACE to {isPaused ? 'resume' : 'pause'}
        </div>
      </div>
    </div>
  );
}