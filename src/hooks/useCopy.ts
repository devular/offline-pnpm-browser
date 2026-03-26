import { useState, useCallback, useRef } from "react";

type CopyStatus = "idle" | "copied" | "error";

export function useCopy(resetMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setStatus("copied");
      } catch {
        setStatus("error");
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus("idle"), resetMs);
    },
    [resetMs],
  );

  return { copy, status, copied: status === "copied" };
}
