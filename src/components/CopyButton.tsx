import { useCopy } from '@root/hooks/useCopy';
import { CopyIcon } from '@root/components/CopyIcon';
import { CheckIcon } from '@root/components/CheckIcon';

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
      <span className="copy-btn-text">{copied ? 'Copied' : 'Copy'}</span>
      <span className="copy-btn-icon">
        {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
      </span>
    </button>
  );
}
