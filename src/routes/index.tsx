import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getBrowserIndexStats } from '@root/lib/browser/indexDb';
import type { BrowserIndexStats } from '@root/lib/browser/packages';
import { getCategories, getDbStats } from '@root/lib/packages.functions';
import { CategoryGrid } from '@root/components/CategoryGrid';
import { BrowserIndexPanel } from '@root/components/browser/BrowserIndexPanel';

export const Route = createFileRoute('/')({
  loader: async () => {
    const [categories, stats] = await Promise.all([getCategories(), getDbStats()]);
    return { categories, stats };
  },
  component: HomePage,
});

function HomePage() {
  const { categories, stats } = Route.useLoaderData();
  const [browserStats, setBrowserStats] = useState<BrowserIndexStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refreshBrowserStats = async () => {
      try {
        const nextStats = await getBrowserIndexStats();
        if (!cancelled) setBrowserStats(nextStats.totalPackages > 0 ? nextStats : null);
      } catch {
        if (!cancelled) setBrowserStats(null);
      }
    };
    const onBrowserIndexUpdated = (event: Event) => {
      const detail = (event as CustomEvent<BrowserIndexStats>).detail;
      setBrowserStats(detail.totalPackages > 0 ? detail : null);
    };

    refreshBrowserStats();
    window.addEventListener('browser-index-updated', onBrowserIndexUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('browser-index-updated', onBrowserIndexUpdated);
    };
  }, []);

  const visibleStats = browserStats
    ? {
        totalPackages: browserStats.totalPackages,
        uniquePackages: browserStats.uniquePackages,
        totalDependencies: browserStats.totalDependencies || stats.total_dependencies,
        totalCategorized: stats.total_categorized,
        source: 'browser',
      }
    : {
        totalPackages: stats.total_packages,
        uniquePackages: stats.unique_packages,
        totalDependencies: stats.total_dependencies,
        totalCategorized: stats.total_categorized,
        source: 'server',
      };

  return (
    <>
      <main className="home-main">
        <div className="home-hero">
          <h2 className="home-title">
            Browse {visibleStats.uniquePackages.toLocaleString()} packages
          </h2>
          <p className="home-subtitle">
            Your local pnpm store, indexed and searchable. Browse READMEs, trace dependency graphs,
            and install packages offline — all from cached data, no network required.
          </p>
          <div className="home-stats">
            <span>{visibleStats.totalPackages.toLocaleString()} versions</span>
            <span>{visibleStats.totalDependencies.toLocaleString()} dependencies</span>
            <span>{visibleStats.totalCategorized} categorized</span>
            <span>{visibleStats.source} stats</span>
          </div>
        </div>

        <BrowserIndexPanel />

        <CategoryGrid categories={categories} />
      </main>

      <footer className="status-bar">
        {visibleStats.totalPackages.toLocaleString()} total versions ·{' '}
        {visibleStats.uniquePackages.toLocaleString()} unique packages ·{' '}
        {visibleStats.totalCategorized} categorized
      </footer>
    </>
  );
}
