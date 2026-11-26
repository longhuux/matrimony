"use client";

import * as React from "react";
import type { InvitationDocumentV2 } from "@/modules/invitation-engine/schema";

export interface ParticlesLayerProps {
  mode: InvitationDocumentV2["theme"]["effects"]["particles"];
  primaryColor?: string;
  accentColor?: string;
  previewMode?: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  color: string;
}

export function ParticlesLayer({
  mode,
  primaryColor = "#8B2635",
  accentColor = "#C89D66",
  previewMode = false,
}: ParticlesLayerProps): React.ReactElement | null {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setReducedMotion(event.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    if (mode === "none" || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = (): void => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const paletteByMode: Record<Exclude<ParticlesLayerProps["mode"], "none">, string[]> = {
      petals: ["#F2B5C4", "#E5989B", primaryColor, "#FADCD9"],
      hearts: [primaryColor, "#D65A6D", accentColor],
      snow: ["#FFFFFF", "#F5ECE6", "#EADBD1"],
      sparkles: [accentColor, "#F7E1A0", "#FFFFFF"],
      confetti: [primaryColor, accentColor, "#9B4A5B", "#E8C58E"],
    };

    const colors = paletteByMode[mode];
    const count = mode === "sparkles" ? 20 : 16;

    const createParticle = (initialY?: number): Particle => ({
      x: Math.random() * width,
      y: initialY ?? -20 - Math.random() * 60,
      size: mode === "snow" ? 2.5 + Math.random() * 3 : 4.5 + Math.random() * 5,
      speedY: mode === "sparkles" ? 0.22 + Math.random() * 0.35 : 0.55 + Math.random() * 0.75,
      speedX: (Math.random() - 0.5) * 0.5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.025,
      alpha: 0.28 + Math.random() * 0.32,
      color: colors[Math.floor(Math.random() * colors.length)],
    });

    const particles: Particle[] = Array.from({ length: count }, () =>
      createParticle(Math.random() * height),
    );

    const drawHeart = (p: Particle): void => {
      const s = p.size * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s, -s * 0.5, -s * 1.4, s * 0.6, 0, s * 1.4);
      ctx.bezierCurveTo(s * 1.4, s * 0.6, s, -s * 0.5, 0, s * 0.3);
      ctx.fill();
    };

    const tick = (): void => {
      if (document.hidden) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * 0.015) * 0.3;
        p.rotation += p.rotationSpeed;

        if (p.y > height + 24) {
          Object.assign(p, createParticle(-16));
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (mode === "snow" || mode === "sparkles") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (mode === "hearts") {
          drawHeart(p);
        } else if (mode === "confetti") {
          ctx.fillRect(-p.size * 0.45, -p.size * 0.25, p.size * 0.9, p.size * 0.5);
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.65, p.size * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(rafId);
    };
  }, [mode, reducedMotion, primaryColor, accentColor]);

  if (mode === "none" || reducedMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none ${previewMode ? "absolute" : "fixed"} inset-0 z-20 opacity-40`}
    />
  );
}
