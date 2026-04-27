import { useState } from 'react';
import { useCopy } from '@root/hooks/useCopy';
import { CopyIcon } from '@root/components/CopyIcon';
import { CheckIcon } from '@root/components/CheckIcon';
import type { BrowserPackageSource } from '@root/lib/browser/packages';

interface InstallCommandOption {
  key: string;
  label: string;
  command: string;
  note: string;
}

export function InstallCommand({
  name,
  version,
  sources,
}: {
  name: string;
  version: string;
  sources: BrowserPackageSource[];
}) {
  const commands = getInstallCommands(name, version, sources);
  const { copy } = useCopy();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  return (
    <div className="install-cmd-list" aria-label="Install commands">
      {commands.map((option) => (
        <button
          className="install-cmd"
          key={option.key}
          type="button"
          onClick={async () => {
            const ok = await copy(option.command);
            if (!ok) return;
            setCopiedKey(option.key);
            window.setTimeout(() => setCopiedKey(null), 2000);
          }}
        >
          <span className="install-cmd-label">{option.label}</span>
          <code className="install-cmd-text">
            <span className="install-cmd-prompt">$</span> {option.command}
          </code>
          <span
            className={`install-cmd-action ${copiedKey === option.key ? 'install-cmd-copied' : ''}`}
          >
            <span className="install-cmd-action-text">
              {copiedKey === option.key ? 'Copied' : 'Click to copy'}
            </span>
            <span className="install-cmd-action-icon">
              {copiedKey === option.key ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            </span>
          </span>
          <span className="install-cmd-note">{option.note}</span>
        </button>
      ))}
    </div>
  );
}

function getInstallCommands(
  name: string,
  version: string,
  sources: BrowserPackageSource[],
): InstallCommandOption[] {
  const sourceTypes = new Set(sources.map((source) => source.type));
  const spec = `${name}@${version}`;
  const commands: InstallCommandOption[] = [];

  if (sourceTypes.has('pnpm')) {
    commands.push({
      key: 'pnpm',
      label: 'pnpm',
      command: `pnpm add ${spec} --offline`,
      note: 'Strict offline install from the pnpm store.',
    });
  }

  if (sourceTypes.has('bun')) {
    commands.push({
      key: 'bun',
      label: 'Bun',
      command: `bun add ${spec}`,
      note: 'Uses Bun cache when available; Bun add has no strict offline flag.',
    });
  }

  if (sourceTypes.has('yarn')) {
    commands.push({
      key: 'yarn',
      label: 'Yarn',
      command: `YARN_ENABLE_NETWORK=0 yarn add ${spec}`,
      note: 'Requires the package zip to exist in the project Yarn cache.',
    });
  }

  if (commands.length === 0) {
    commands.push({
      key: 'pnpm-fallback',
      label: 'pnpm',
      command: `pnpm add ${spec} --offline`,
      note: 'Only works if this package exists in your pnpm store.',
    });
  }

  return commands;
}
