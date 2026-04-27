import { useState, useCallback, useRef } from 'react';

type CopyStatus = 'idle' | 'copied' | 'error';

/** Fallback for iOS Safari and non-HTTPS contexts */
function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Avoid scrolling on iOS
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  // iOS Safari needs setSelectionRange
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export function useCopy(resetMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const copy = useCallback(
    async (text: string) => {
      let ok = false;

      // Try modern API first (requires HTTPS + user gesture)
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          ok = false;
        }
      }

      // Fallback for HTTP / iOS Safari
      if (!ok) {
        ok = fallbackCopy(text);
      }

      setStatus(ok ? 'copied' : 'error');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), resetMs);
      return ok;
    },
    [resetMs],
  );

  return { copy, status, copied: status === 'copied' };
}
