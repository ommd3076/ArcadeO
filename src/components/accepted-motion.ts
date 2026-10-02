import { useEffect, useRef } from "react";

export interface AcceptedMotionOptions {
  /** False while the view is catching up or transport is not authoritative. */
  enabled?: boolean;
}

/**
 * Play a visual response only for a newly delivered accepted event.
 *
 * Motion is presentation only: every cancellation reveals the saved DOM state.
 * `null` delivery (snapshot reconciliation) cancels current travel but does not
 * clear the dedupe key, so a repeated event cannot replay after reconciliation.
 */
export function useAcceptedMotion<Effect>(
  eventId: string | number | null | undefined,
  effects: readonly Effect[] | undefined,
  play: (effects: readonly Effect[], reduceMotion: boolean) => readonly Animation[] | undefined,
  { enabled = true }: AcceptedMotionOptions = {},
): void {
  const seen = useRef<string | number | null | undefined>(eventId);
  const active = useRef<readonly Animation[]>([]);
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    const cancel = () => {
      active.current.forEach((animation) => animation.cancel());
      active.current = [];
    };

    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const settleWhenUnavailable = () => cancel();
    const settleWhenHidden = () => {
      if (document.hidden) cancel();
    };
    if (media?.addEventListener) media.addEventListener("change", settleWhenUnavailable);
    else media?.addListener?.(settleWhenUnavailable);
    window.addEventListener("offline", settleWhenUnavailable);
    window.addEventListener("online", settleWhenUnavailable);
    window.addEventListener("pagehide", settleWhenUnavailable);
    window.addEventListener("blur", settleWhenUnavailable);
    document.addEventListener("visibilitychange", settleWhenHidden);

    if (eventId == null) {
      cancel();
    } else if (eventId !== seen.current) {
      seen.current = eventId;
      cancel();
      if (
        enabled &&
        effects?.length &&
        !media?.matches &&
        navigator.onLine !== false &&
        !document.hidden
      ) {
        active.current = playRef.current(effects, false) ?? [];
      }
    } else if (!enabled) {
      cancel();
    }

    return () => {
      if (media?.removeEventListener) media.removeEventListener("change", settleWhenUnavailable);
      else media?.removeListener?.(settleWhenUnavailable);
      window.removeEventListener("offline", settleWhenUnavailable);
      window.removeEventListener("online", settleWhenUnavailable);
      window.removeEventListener("pagehide", settleWhenUnavailable);
      window.removeEventListener("blur", settleWhenUnavailable);
      document.removeEventListener("visibilitychange", settleWhenHidden);
    };
  }, [eventId, effects, enabled]);

  useEffect(
    () => () => {
      active.current.forEach((animation) => animation.cancel());
      active.current = [];
    },
    [],
  );
}
