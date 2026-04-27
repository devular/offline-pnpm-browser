import { Link } from '@tanstack/react-router';
import type { BrowserIndexStats } from '@root/lib/browser/packages';

export function CacheConfigureCallout({
  stats,
  position,
}: {
  stats: BrowserIndexStats | null;
  position: 'top' | 'bottom';
}) {
  const hasIndex = Boolean(stats?.totalPackages);

  return (
    <section className={`cache-config-callout cache-config-callout-${position}`}>
      <div className="cache-config-body">
        <h3>{hasIndex ? 'Local cache configured' : 'Configure your local cache'}</h3>
        <p>
          {hasIndex
            ? 'Add another package manager cache or refresh the browser index from local files.'
            : 'Choose a pnpm, Bun, or Yarn cache to build a local browser index before searching packages.'}
        </p>
        <div className="cache-config-status">
          <span>{stats?.totalPackages.toLocaleString() ?? '0'} versions</span>
          <span>{stats?.uniquePackages.toLocaleString() ?? '0'} packages</span>
          <span>{stats ? formatBytes(stats.totalSize) : '0 B'} indexed</span>
          <span>{stats?.persisted ? 'persistent storage' : 'best-effort storage'}</span>
        </div>
        {stats?.storeName && (
          <p className="cache-config-meta">
            Last source: {stats.storeName}
            {stats.lastIndexedAt ? ` · indexed ${formatDate(stats.lastIndexedAt)}` : ''}
          </p>
        )}
      </div>
      <Link to="/configure" className="cache-config-link">
        {hasIndex ? 'Configure caches' : 'Configure local cache'}
      </Link>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
