import { useEffect, useRef } from "react";

/** Play a visual response only when a new saved event arrives after mount. */
export function useAcceptedMotion<Effect>(
  eventId: string | number | null | undefined,
  effects: readonly Effect[] | undefined,
  play: (effects: readonly Effect[], reduceMotion: boolean) => readonly Animation[] | undefined,
): void {
  const seen = useRef(eventId);
  const active = useRef<readonly Animation[]>([]);
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    if (eventId == null) {
      active.current.forEach((animation) => animation.cancel());
      active.current = [];
      seen.current = null;
      return;
    }
    if (eventId === seen.current || !effects?.length) return;
    seen.current = eventId;
    active.current.forEach((animation) => animation.cancel());
    active.current = [];
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    active.current = playRef.current(effects, reduceMotion) ?? [];
  }, [eventId, effects]);

  useEffect(() => () => active.current.forEach((animation) => animation.cancel()), []);
}
