/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useNavigate,
} from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function RootLayout() {
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef('');

  // / key focuses search from anywhere
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Console easter egg
  useEffect(() => {
    console.log(
      '%c[ PACKAGE EXPLORER ]%c\nBuilt with TanStack Start + SQLite FTS5\n9,855 packages indexed from your local pnpm store',
      'font-weight:bold;font-size:14px;font-family:monospace',
      'font-family:monospace;color:#8a8a94',
    );
  }, []);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.trim();
    queryRef.current = q;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      setSearchResults(null);
      setIsSearchOpen(false);
      setActiveIndex(-1);
      return;
    }

    setIsSearchOpen(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPackages({ data: { q, limit: 8 } });
      setSearchResults(results);
      setActiveIndex(-1);
    }, 150);
  }, []);

  const dismiss = useCallback(() => {
    setSearchResults(null);
    setIsSearchOpen(false);
    setActiveIndex(-1);
    if (inputRef.current) inputRef.current.value = '';
    queryRef.current = '';
  }, []);

  const selectResult = useCallback(
    (name: string) => {
      dismiss();
      navigate({ to: '/package/$name', params: { name } });
    },
    [dismiss, navigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const results = searchResults?.results;
      if (!results?.length) {
        if (e.key === 'Escape') {
          dismiss();
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            selectResult(results[activeIndex].name);
          }
          break;
        case 'Escape':
          dismiss();
          inputRef.current?.blur();
          break;
      }
    },
    [searchResults, activeIndex, dismiss, selectResult],
  );

  return (
    <div className="app">
      <nav className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="site-logo" onClick={dismiss}>
            Package Explorer
          </Link>
          <div
            className="header-search-wrap"
            role="combobox"
            aria-expanded={isSearchOpen}
            aria-haspopup="listbox"
          >
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
              role="searchbox"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
            />
            {isSearchOpen && searchResults && (
              <div className="search-dropdown" role="listbox">
                {searchResults.count === 0 ? (
                  <div className="search-dropdown-empty">No results</div>
                ) : (
                  <>
                    {searchResults.results.map((pkg, i) => (
                      <Link
                        key={`${pkg.name}-${pkg.id}`}
                        id={`search-result-${i}`}
                        to="/package/$name"
                        params={{ name: pkg.name }}
                        className={`search-dropdown-item ${i === activeIndex ? 'search-dropdown-active' : ''}`}
                        onClick={dismiss}
                        role="option"
                        aria-selected={i === activeIndex}
                      >
                        <span className="search-dropdown-name">
                          {highlightMatch(pkg.name, queryRef.current)}
                        </span>
                        <span className="search-dropdown-ver">{pkg.version}</span>
                        {pkg.description && (
                          <span className="search-dropdown-desc">{pkg.description}</span>
                        )}
                      </Link>
                    ))}
                    {searchResults.count > 8 && (
                      <div className="search-dropdown-more">
                        {searchResults.count - 8} more results &middot; refine your search
                      </div>
                    )}
                    <div className="search-dropdown-hint">
                      <kbd>&uarr;</kbd>
                      <kbd>&darr;</kbd> navigate
                      <kbd>&crarr;</kbd> select
                      <kbd>esc</kbd> close
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {isSearchOpen && <div className="search-overlay" onClick={dismiss} />}

      <Outlet />
    </div>
  );
}
