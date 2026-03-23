/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useNavigate,
} from '@tanstack/react-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { searchPackages } from '../lib/packages.functions';
import type { SearchResponse } from '../lib/packages.functions';
import appCss from '../styles/global.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'Package Explorer — offline-setup' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous' as const,
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&family=IBM+Plex+Mono:wght@400;500&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      setSearchResults(null);
      setIsSearchOpen(false);
      return;
    }

    setIsSearchOpen(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPackages({ data: { q, limit: 8 } });
      setSearchResults(results);
    }, 150);
  }, []);

  const handleResultClick = useCallback(() => {
    setSearchResults(null);
    setIsSearchOpen(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchResults(null);
      setIsSearchOpen(false);
      if (inputRef.current) inputRef.current.blur();
    }
  }, []);

  return (
    <div className="app">
      <nav className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="site-logo" onClick={handleResultClick}>
            Package Explorer
          </Link>
          <div className="header-search-wrap">
            <input
              ref={inputRef}
              type="text"
              className="header-search-input"
              placeholder="Search packages..."
              onChange={handleSearch}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                if (e.target.value.trim()) setIsSearchOpen(true);
              }}
            />
            {isSearchOpen && searchResults && (
              <div className="search-dropdown">
                {searchResults.count === 0 ? (
                  <div className="search-dropdown-empty">No results</div>
                ) : (
                  <>
                    {searchResults.results.map((pkg) => (
                      <Link
                        key={`${pkg.name}-${pkg.id}`}
                        to="/package/$name"
                        params={{ name: pkg.name }}
                        className="search-dropdown-item"
                        onClick={handleResultClick}
                      >
                        <span className="search-dropdown-name">{pkg.name}</span>
                        <span className="search-dropdown-ver">{pkg.version}</span>
                        {pkg.description && (
                          <span className="search-dropdown-desc">{pkg.description}</span>
                        )}
                      </Link>
                    ))}
                    {searchResults.count > 8 && (
                      <div className="search-dropdown-more">
                        {searchResults.count - 8} more results
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {isSearchOpen && <div className="search-overlay" onClick={handleResultClick} />}

      <Outlet />
    </div>
  );
}
