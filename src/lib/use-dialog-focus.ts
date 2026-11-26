"use client";

import * as React from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export interface UseDialogFocusOptions {
  onClose?: () => void;
  lockScroll?: boolean;
  disabled?: boolean;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Manages WAI-ARIA modal focus: moves focus inside on open, traps Tab/Shift+Tab,
 * triggers onClose on Escape, and restores focus to the opener element on close.
 */
export function useDialogFocus(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  optionsOrOnClose?: (() => void) | UseDialogFocusOptions,
): void {
  const options: UseDialogFocusOptions =
    typeof optionsOrOnClose === "function"
      ? { onClose: optionsOrOnClose }
      : (optionsOrOnClose ?? {});

  const { onClose, lockScroll = true, disabled = false } = options;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!isOpen || disabled) return;

    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    if (lockScroll) {
      document.body.style.overflow = "hidden";
    }

    const rafId = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      if (container.contains(document.activeElement)) return;
      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        if (onCloseRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
      if (lockScroll) {
        document.body.style.overflow = previousOverflow;
      }
      if (opener && document.body.contains(opener)) {
        opener.focus();
      }
    };
  }, [isOpen, containerRef, lockScroll, disabled]);
}
