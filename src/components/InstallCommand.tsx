import { useCopy } from '@root/hooks/useCopy';
import { CopyIcon } from '@root/components/CopyIcon';
import { CheckIcon } from '@root/components/CheckIcon';

export function InstallCommand({ name, version }: { name: string; version: string }) {
  const cmd = `pnpm add ${name}@${version} --offline`;
  const { copy, copied } = useCopy();

  return (
    <div className="install-cmd" onClick={() => copy(cmd)}>
      <code className="install-cmd-text">
        <span className="install-cmd-prompt">$</span> {cmd}
      </code>
      <span className={`install-cmd-action ${copied ? 'install-cmd-copied' : ''}`}>
        <span className="install-cmd-action-text">{copied ? 'Copied' : 'Click to copy'}</span>
        <span className="install-cmd-action-icon">
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        </span>
      </span>
    </div>
  );
}
