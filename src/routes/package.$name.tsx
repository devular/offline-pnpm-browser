import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useMemo, useRef, useEffect } from 'react';
import { marked, type MarkedExtension } from 'marked';
import { highlight } from 'sugar-high';
import { getBrowserDependents, getBrowserPackageDetail } from '@root/lib/browser/indexDb';
import { Badge } from '@root/components/Badge';
import { InstallCommand } from '@root/components/InstallCommand';
import { VersionSelector } from '@root/components/VersionSelector';
import { DepsSection } from '@root/components/DepsSection';
import { CollapsibleDependents } from '@root/components/CollapsibleDependents';

type PackageSearch = { v?: string };

export const Route = createFileRoute('/package/$name')({
  validateSearch: (search: Record<string, unknown>): PackageSearch => ({
    v: typeof search.v === 'string' ? search.v : undefined,
  }),
  loaderDeps: ({ search }) => ({ version: search.v }),
  loader: async ({ params, deps }) => {
    const [pkg, dependents] = await Promise.all([
      getBrowserPackageDetail(params.name, deps.version),
      getBrowserDependents(params.name),
    ]);
    if (!pkg) throw notFound();
    return { pkg, dependents, versions: pkg.versions };
  },
  component: PackagePage,
});

// --- Helpers ---

function cleanAuthor(author: string): string {
  return author
    .replace(/<[^>]+>/g, '')
    .replace(/\([^)]+\)/g, '')
    .trim();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function repoDisplayUrl(url: string): string {
  const cleaned = url.replace(/^git\+/, '').replace(/\.git$/, '');
  if (/github\.com/.test(cleaned)) {
    return cleaned.replace(/^https?:\/\/github\.com\//, '');
  }
  return cleaned.replace(/^https?:\/\//, '');
}

function repoHref(url: string): string {
  return url.replace(/^git\+/, '').replace(/\.git$/, '');
}

// --- Code blocks with copy ---

function buildReadmeHtml(readme: string): string | null {
  try {
    let blockIndex = 0;
    const renderer: MarkedExtension = {
      renderer: {
        code({ text, lang }) {
          const highlighted = highlight(text);
          const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
          const id = `code-block-${blockIndex++}`;
          return `<div class="code-block-wrap" id="${id}">${langLabel}<pre class="sh-code"><code>${highlighted}</code></pre><button class="copy-btn copy-btn-code" data-copy-target="${id}" aria-label="Copy code">Copy</button></div>`;
        },
      },
    };
    return marked.use(renderer).parse(readme, { async: false }) as string;
  } catch {
    return null;
  }
}

// --- Page ---

function PackagePage() {
  const { pkg, dependents, versions } = Route.useLoaderData();
  const readmeRef = useRef<HTMLDivElement>(null);

  const readmeHtml = useMemo(() => {
    if (!pkg.readme) return null;
    return buildReadmeHtml(pkg.readme);
  }, [pkg.readme]);

  // Attach copy handlers to code block buttons (event delegation)
  useEffect(() => {
    const el = readmeRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.copy-btn-code') as HTMLElement | null;
      if (!btn) return;
      const targetId = btn.dataset.copyTarget;
      if (!targetId) return;
      const pre = document.getElementById(targetId);
      if (!pre) return;
      const code = pre.querySelector('code');
      if (!code) return;
      const text = code.textContent ?? '';
      const doCopy = async () => {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
          document.body.appendChild(ta);
          ta.focus();
          ta.setSelectionRange(0, text.length);
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          return ok;
        }
      };
      doCopy().then((ok) => {
        if (!ok) return;
        btn.textContent = 'Copied';
        btn.classList.add('copy-btn-done');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copy-btn-done');
        }, 2000);
      });
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [readmeHtml]);

  const runtimeDepCount = pkg.dependenciesByType.runtime.length;
  const peerDepCount = pkg.dependenciesByType.peer.length;
  const devDepCount = pkg.dependenciesByType.dev.length;
  const optionalDepCount = pkg.dependenciesByType.optional.length;
  const totalDeps = runtimeDepCount + peerDepCount + devDepCount + optionalDepCount;

  return (
    <main className="pkg-page">
      <section className="pkg-identity">
        <div className="pkg-name-row">
          <h1 className="pkg-title">{pkg.name}</h1>
          <VersionSelector
            currentVersion={pkg.version}
            versions={versions}
            packageName={pkg.name}
          />
          {pkg.license && <Badge variant="license">{pkg.license}</Badge>}
        </div>
        {pkg.description && <p className="pkg-desc-line">{pkg.description}</p>}

        <div className="pkg-meta-row">
          {pkg.author && <span className="meta-item">{cleanAuthor(pkg.author)}</span>}
          {pkg.repository && (
            <a
              href={repoHref(pkg.repository)}
              target="_blank"
              rel="noopener noreferrer"
              className="meta-item meta-item-link"
            >
              {repoDisplayUrl(pkg.repository)}
            </a>
          )}
          {pkg.homepage && (
            <a
              href={pkg.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="meta-item meta-item-link"
            >
              {pkg.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
          <span className="meta-item">{pkg.fileCount} files</span>
          <span className="meta-item">{formatBytes(pkg.totalSize)}</span>
        </div>

        {/* Install command */}
        <InstallCommand name={pkg.name} version={pkg.version} />

        {(pkg.categories.length > 0 || pkg.keywords.length > 0) && (
          <div className="pkg-tags-row">
            {pkg.categories.map((cat) => (
              <Link
                key={cat.category_slug}
                to="/category/$slug"
                params={{ slug: cat.category_slug }}
                className={`badge badge-${cat.type}`}
              >
                {cat.category_name}
              </Link>
            ))}
            {pkg.keywords.map((kw) => (
              <Badge key={kw} variant="keyword">
                {kw}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {readmeHtml && (
        <section className="pkg-readme" ref={readmeRef}>
          <div className="readme-body" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
        </section>
      )}
      {pkg.readme && !readmeHtml && (
        <section className="pkg-readme">
          <pre className="readme-body readme-raw">{pkg.readme}</pre>
        </section>
      )}

      {(totalDeps > 0 || dependents.count > 0) && (
        <section className="pkg-graph">
          <h2 className="pkg-graph-title">Dependency Graph</h2>

          <div className="pkg-graph-summary">
            {runtimeDepCount > 0 && <span className="graph-stat">{runtimeDepCount} deps</span>}
            {peerDepCount > 0 && <span className="graph-stat">{peerDepCount} peer</span>}
            {devDepCount > 0 && <span className="graph-stat">{devDepCount} dev</span>}
            {optionalDepCount > 0 && (
              <span className="graph-stat">{optionalDepCount} optional</span>
            )}
            {dependents.count > 0 && (
              <span className="graph-stat graph-stat-accent">{dependents.count} dependents</span>
            )}
          </div>

          <DepsSection title="Dependencies" deps={pkg.dependenciesByType.runtime} defaultOpen />
          <DepsSection title="Peer Dependencies" deps={pkg.dependenciesByType.peer} defaultOpen />
          <DepsSection
            title="Dev Dependencies"
            deps={pkg.dependenciesByType.dev}
            defaultOpen={devDepCount <= 10}
          />
          <DepsSection
            title="Optional Dependencies"
            deps={pkg.dependenciesByType.optional}
            defaultOpen={optionalDepCount <= 10}
          />

          <CollapsibleDependents dependents={dependents} />
        </section>
      )}
    </main>
  );
}
