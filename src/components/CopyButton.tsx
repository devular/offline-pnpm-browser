import { useCopy } from '../hooks';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const { copy, copied } = useCopy();

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? 'copy-btn-done' : ''} ${className ?? ''}`}
      onClick={() => copy(text)}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
