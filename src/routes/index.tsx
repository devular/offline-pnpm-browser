import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getBrowserIndexStats } from '@root/lib/browser/indexDb';
import type { BrowserIndexStats } from '@root/lib/browser/packages';
import { getBrowserCategories } from '@root/lib/browser/categories';
import { CategoryGrid } from '@root/components/CategoryGrid';
import { CacheConfigureCallout } from '@root/components/CacheConfigureCallout';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const categories = getBrowserCategories();
  const [browserStats, setBrowserStats] = useState<BrowserIndexStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refreshBrowserStats = async () => {
      try {
        const nextStats = await getBrowserIndexStats();
        if (!cancelled) {
          setBrowserStats(nextStats.totalPackages > 0 ? nextStats : null);
        }
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
        totalDependencies: browserStats.totalDependencies,
        totalCategorized: categories.totalPackages,
        source: 'browser',
      }
    : {
        totalPackages: 0,
        uniquePackages: 0,
        totalDependencies: 0,
        totalCategorized: categories.totalPackages,
        source: 'browser',
      };

  return (
    <>
      <main className="home-main">
        {!browserStats && <CacheConfigureCallout stats={browserStats} position="top" />}

        <div className="home-hero">
          <h2 className="home-title">
            Browse {visibleStats.uniquePackages.toLocaleString()} packages
          </h2>
          <p className="home-subtitle">
            Your local package caches, indexed and searchable. Browse READMEs, trace dependency
            graphs, and install packages offline — all from cached data, no network required.
          </p>
          <div className="home-stats">
            <span>{visibleStats.totalPackages.toLocaleString()} versions</span>
            <span>{visibleStats.totalDependencies.toLocaleString()} dependencies</span>
            <span>{visibleStats.totalCategorized} categorized</span>
            <span>{visibleStats.source} stats</span>
          </div>
        </div>

        <CategoryGrid categories={categories} />

        {browserStats && <CacheConfigureCallout stats={browserStats} position="bottom" />}
      </main>

      <footer className="status-bar">
        {visibleStats.totalPackages.toLocaleString()} total versions ·{' '}
        {visibleStats.uniquePackages.toLocaleString()} unique packages ·{' '}
        {visibleStats.totalCategorized} categorized
      </footer>
    </>
  );
}
