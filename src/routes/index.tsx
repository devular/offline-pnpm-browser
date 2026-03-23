import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback, useRef } from 'react';
import { getCategories, searchPackages, getDbStats } from '../lib/packages.functions';
import type { CategoriesResponse, SearchResponse } from '../lib/packages.functions';
import type { DbStats } from '../lib/db.server';

export const Route = createFileRoute('/')({
  loader: async () => {
    const [categories, stats] = await Promise.all([getCategories(), getDbStats()]);
    return { categories, stats };
  },
  component: HomePage,
});

function HomePage() {
  const { categories, stats } = Route.useLoaderData();
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPackages({ data: { q, limit: 50 } });
      setSearchResults(results);
      setIsSearching(false);
    }, 150);
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Package Explorer</h1>
        <div className="search-wrap">
          <input
            type="text"
            className="search-input"
            placeholder={`Search ${stats.total_packages.toLocaleString()} packages…`}
            onChange={handleSearch}
            autoFocus
          />
        </div>
      </header>

      <main>
        {searchResults ? (
          <SearchResults results={searchResults} isSearching={isSearching} />
        ) : (
          <CategoryGrid categories={categories} />
        )}
      </main>

      <footer className="status-bar">
        {stats.unique_packages.toLocaleString()} unique packages ·{' '}
        {stats.total_dependencies.toLocaleString()} dependencies · {stats.total_categorized}{' '}
        categorized
      </footer>
    </div>
  );
}

function CategoryGrid({ categories }: { categories: CategoriesResponse }) {
  return (
    <section>
      <div className="category-grid">
        {categories.categories.map((cat) => (
          <Link
            key={cat.slug}
            to="/category/$slug"
            params={{ slug: cat.slug }}
            className="cat-card"
          >
            <h3>{cat.name}</h3>
            <span className="count">{cat.count} packages</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SearchResults({
  results,
  isSearching,
}: {
  results: SearchResponse;
  isSearching: boolean;
}) {
  if (isSearching) {
    return <div className="loading">Searching</div>;
  }

  if (results.count === 0) {
    return <div className="no-results">No packages found for "{results.query}"</div>;
  }

  return (
    <section className="search-results">
      <p className="result-count">{results.count} results</p>
      {results.results.map((pkg) => (
        <Link
          key={`${pkg.name}-${pkg.id}`}
          to="/package/$name"
          params={{ name: pkg.name }}
          className="pkg-item"
        >
          <span className="pkg-name">{pkg.name}</span>
          <span className="pkg-version">{pkg.version}</span>
          {pkg.license && <span className="badge badge-license">{pkg.license}</span>}
          {pkg.description && <span className="pkg-desc">{pkg.description}</span>}
        </Link>
      ))}
    </section>
  );
}
