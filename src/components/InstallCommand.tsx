import { useCopy } from '@root/hooks/useCopy';

export function InstallCommand({ name, version }: { name: string; version: string }) {
  const cmd = `pnpm add ${name}@${version} --offline`;
  const { copy, copied } = useCopy();

  return (
    <div className="install-cmd" onClick={() => copy(cmd)}>
      <code className="install-cmd-text">
        <span className="install-cmd-prompt">$</span> {cmd}
      </code>
      <span className={`install-cmd-action ${copied ? 'install-cmd-copied' : ''}`}>
        {copied ? 'Copied' : 'Click to copy'}
      </span>
    </div>
  );
}
