import { useState, useEffect, useCallback, useRef } from "react";

export interface UseSecretConcealmentOptions {
  onConceal?: () => void;
  enabled?: boolean;
}

export function useSecretConcealment({
  onConceal,
  enabled = true,
}: UseSecretConcealmentOptions = {}) {
  const [isMasked, setIsMasked] = useState<boolean>(false);
  const onConcealRef = useRef(onConceal);
  onConcealRef.current = onConceal;

  const mask = useCallback(() => {
    setIsMasked(true);
    onConcealRef.current?.();
  }, []);

  const unmask = useCallback(() => {
    setIsMasked(false);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        mask();
      }
    };

    const handleBlur = () => {
      mask();
    };

    const handlePageHide = () => {
      mask();
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [enabled, mask]);

  return {
    isMasked,
    mask,
    unmask,
  };
}
