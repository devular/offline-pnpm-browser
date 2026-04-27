import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { BrowserIndexPanel } from '@root/components/browser/BrowserIndexPanel';
import { DirectoryIndexPanel } from '@root/components/browser/DirectoryIndexPanel';
import { packageSourceAdapters } from '@root/lib/browser/adapters';
import { getBrowserIndexStats } from '@root/lib/browser/indexDb';
import type { BrowserIndexStats } from '@root/lib/browser/packages';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
});

function OnboardingPage() {
  const [stats, setStats] = useState<BrowserIndexStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const nextStats = await getBrowserIndexStats();
      if (!cancelled) setStats(nextStats.totalPackages > 0 ? nextStats : null);
    };
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<BrowserIndexStats>).detail;
      setStats(detail.totalPackages > 0 ? detail : null);
    };

    refresh();
    window.addEventListener('browser-index-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('browser-index-updated', onUpdated);
    };
  }, []);

  return (
    <main className="onboarding-page">
      <section className="onboarding-hero">
        <h1>Choose a local package cache</h1>
        <p>
          Package Explorer builds one deduped browser index from package manager caches you grant.
          Everything stays local in this browser.
        </p>
        {stats && (
          <Link to="/" className="onboarding-primary-link">
            Open explorer with {stats.uniquePackages.toLocaleString()} packages
          </Link>
        )}
      </section>

      <section className="source-grid" aria-label="Package sources">
        {packageSourceAdapters.map((adapter) => (
          <article className="source-card" key={adapter.id}>
            <div className="source-card-head">
              <h2>{adapter.label}</h2>
              <span className={`source-status source-status-${adapter.status}`}>
                {adapter.status === 'ready' ? 'Ready' : 'Planned'}
              </span>
            </div>
            <p>{adapter.description}</p>
            <p className="source-hint">{adapter.folderHint}</p>
          </article>
        ))}
      </section>

      <BrowserIndexPanel />
      <DirectoryIndexPanel
        sourceType="bun"
        title="Bun cache"
        description="Choose Bun's global install cache, usually ~/.bun/install/cache. Package folders are merged into the same browser index and deduped by name and version."
        buttonLabel="Choose Bun cache"
      />
    </main>
  );
}
