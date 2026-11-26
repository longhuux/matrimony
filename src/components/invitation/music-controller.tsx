"use client";

import * as React from "react";
import { ArrowDown, Pause, Play } from "lucide-react";
import type { InvitationDocumentV2 } from "@/modules/invitation-engine/schema";
import { BUILT_IN_MUSIC_TRACKS } from "@/modules/invitation-engine/templates";

export interface MusicControllerProps {
  music?: InvitationDocumentV2["theme"]["music"];
  autoScrollSpeed?: number;
  palette: InvitationDocumentV2["theme"]["palette"];
  previewMode?: boolean;
}

const TRACK_CHORDS: Record<string, number[]> = {
  "anh-nang-cua-anh": [261.63, 329.63, 392.0, 493.88, 523.25], // Cmaj7
  "ngay-chung-doi": [293.66, 369.99, 440.0, 554.37, 587.33], // Dmaj7
  "tram-nam-hanh-phuc": [220.0, 261.63, 329.63, 392.0, 440.0], // Am7
  "dem-sao-nguyen-uoc": [246.94, 311.13, 369.99, 440.0, 493.88], // B7 warm
};

function isDarkHex(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}

export function MusicController({
  music,
  autoScrollSpeed = 0,
  palette,
  previewMode = false,
}: MusicControllerProps): React.ReactElement {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const synthCtxRef = React.useRef<AudioContext | null>(null);
  const synthTimerRef = React.useRef<number | null>(null);
  const scrollRafRef = React.useRef<number | null>(null);

  const customUrl = music?.url?.trim() ?? "";
  const trackInfo =
    BUILT_IN_MUSIC_TRACKS.find((t) => t.id === music?.trackId) ??
    BUILT_IN_MUSIC_TRACKS[0];
  const displayTitle = music?.title?.trim() || trackInfo.title;
  const isDark = isDarkHex(palette.background);

  const stopSynth = React.useCallback((): void => {
    if (synthTimerRef.current !== null) {
      window.clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
    if (synthCtxRef.current) {
      void synthCtxRef.current.close().catch(() => undefined);
      synthCtxRef.current = null;
    }
  }, []);

  const startSynth = React.useCallback((): void => {
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    stopSynth();
    const ctx = new AudioCtx();
    synthCtxRef.current = ctx;

    const notes =
      TRACK_CHORDS[trackInfo.id] ?? TRACK_CHORDS["anh-nang-cua-anh"];
    let step = 0;

    const playNote = (): void => {
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(notes[step % notes.length], now);
      step += 1;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.65);
    };

    playNote();
    synthTimerRef.current = window.setInterval(playNote, 900);
  }, [stopSynth, trackInfo.id]);

  const togglePlay = async (): Promise<void> => {
    if (isPlaying) {
      audioRef.current?.pause();
      stopSynth();
      setIsPlaying(false);
      return;
    }

    if (customUrl && audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        return;
      } catch {
        // Fallback cleanly to ambient WebAudio synth if audio file fails
      }
    }

    startSynth();
    setIsPlaying(true);
  };

  React.useEffect(() => {
    if (!isAutoScrolling) {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIsAutoScrolling(false);
      return;
    }

    const pxPerFrame = Math.max(0.4, (autoScrollSpeed > 0 ? autoScrollSpeed : 0.05) * 14);
    let lastTime = performance.now();

    const step = (now: number): void => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;
      window.scrollBy(0, pxPerFrame * (dt / 16.67));
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setIsAutoScrolling(false);
        return;
      }
      scrollRafRef.current = window.requestAnimationFrame(step);
    };

    scrollRafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [isAutoScrolling, autoScrollSpeed]);

  React.useEffect(() => {
    const audioEl = audioRef.current;
    return () => {
      audioEl?.pause();
      stopSynth();
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [stopSynth]);

  const dockPositionClass = previewMode
    ? "absolute bottom-4 right-3 z-40 flex flex-col items-end gap-2"
    : "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2 sm:right-4";

  const glassButtonSurfaceClass = isDark
    ? "border-[#E6C280]/35 bg-[#231B18]/85 text-[#FFFCF9] hover:bg-[#2E2420]"
    : "border-border/80 bg-surface/85 text-ink hover:bg-blush-hover";

  return (
    <div className={dockPositionClass}>
      {customUrl ? (
        <audio ref={audioRef} src={customUrl} loop preload="none" />
      ) : null}

      {isPlaying ? (
        <span
          className={`hidden max-w-[140px] truncate rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md sm:inline-flex ${
            isDark
              ? "border-[#E6C280]/30 bg-[#231B18]/85 text-[#FFFCF9]"
              : "border-border/80 bg-surface/85 text-ink"
          }`}
          title={displayTitle}
        >
          {displayTitle}
        </span>
      ) : null}

      {autoScrollSpeed > 0 ? (
        <button
          type="button"
          onClick={() => setIsAutoScrolling((prev) => !prev)}
          aria-pressed={isAutoScrolling}
          aria-label={isAutoScrolling ? "Dừng tự động cuộn" : "Tự động cuộn thiệp"}
          title={isAutoScrolling ? "Dừng tự động cuộn" : "Tự động cuộn thiệp"}
          className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors duration-200 ${
            isAutoScrolling
              ? isDark
                ? "border-[#E6C280] bg-[#E6C280] text-[#16100E]"
                : "border-burgundy bg-burgundy text-ivory"
              : glassButtonSurfaceClass
          }`}
        >
          <ArrowDown
            className={`h-4 w-4 ${isAutoScrolling ? "animate-bounce motion-reduce:animate-none" : ""}`}
            aria-hidden="true"
          />
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? "Tạm dừng nhạc" : `Phát nhạc: ${displayTitle}`}
        title={displayTitle}
        className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors duration-200 ${glassButtonSurfaceClass}`}
      >
        {isPlaying ? (
          <Pause
            className="h-4 w-4"
            style={{ color: isDark ? "#E6C280" : "var(--tpl-primary-ink, #8B2635)" }}
            aria-hidden="true"
          />
        ) : (
          <Play className="h-4 w-4 translate-x-[0.5px]" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
