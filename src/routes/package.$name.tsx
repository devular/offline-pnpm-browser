import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { marked } from 'marked';
import { getPackageDetail, getDependents } from '../lib/packages.functions';
import type { DependentsResponse } from '../lib/packages.functions';

export const Route = createFileRoute('/package/$name')({
  loader: async ({ params }) => {
    const [pkg, dependents] = await Promise.all([
      getPackageDetail({ data: params.name }),
      getDependents({ data: params.name }),
    ]);
    if (!pkg) throw new Error('Package not found');
    return { pkg, dependents };
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

// --- Page ---

function PackagePage() {
  const { pkg, dependents } = Route.useLoaderData();

  const readmeHtml = useMemo(() => {
    if (!pkg.readme) return null;
    try {
      return marked.parse(pkg.readme, { async: false }) as string;
    } catch {
      return null;
    }
  }, [pkg.readme]);

  const runtimeDepCount = pkg.dependencies.runtime.length;
  const peerDepCount = pkg.dependencies.peer.length;
  const devDepCount = pkg.dependencies.dev.length;
  const optionalDepCount = pkg.dependencies.optional.length;
  const totalDeps = runtimeDepCount + peerDepCount + devDepCount + optionalDepCount;

  return (
    <main className="pkg-page">
      {/* === Package identity === */}
      <section className="pkg-identity">
        <div className="pkg-name-row">
          <h1 className="pkg-title">{pkg.name}</h1>
          <span className="pkg-ver">{pkg.version}</span>
          {pkg.license && <span className="badge badge-license">{pkg.license}</span>}
        </div>
        {pkg.description && <p className="pkg-desc-line">{pkg.description}</p>}

        {/* Compact meta row */}
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

        {/* Tags row: categories + keywords */}
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
              <span key={kw} className="badge badge-keyword">
                {kw}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* === README — the hero content === */}
      {readmeHtml && (
        <section className="pkg-readme">
          <div className="readme-body" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
        </section>
      )}
      {pkg.readme && !readmeHtml && (
        <section className="pkg-readme">
          <pre className="readme-body readme-raw">{pkg.readme}</pre>
        </section>
      )}

      {/* === Dependencies & Dependents === */}
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

          <DepsSection title="Dependencies" deps={pkg.dependencies.runtime} defaultOpen />
          <DepsSection title="Peer Dependencies" deps={pkg.dependencies.peer} defaultOpen />
          <DepsSection
            title="Dev Dependencies"
            deps={pkg.dependencies.dev}
            defaultOpen={devDepCount <= 10}
          />
          <DepsSection
            title="Optional Dependencies"
            deps={pkg.dependencies.optional}
            defaultOpen={optionalDepCount <= 10}
          />

          <CollapsibleDependents dependents={dependents} />
        </section>
      )}
    </main>
  );
}

function DepsSection({
  title,
  deps,
  defaultOpen = true,
}: {
  title: string;
  deps: Array<{ dep_name: string; dep_version: string }>;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (deps.length === 0) return null;

  return (
    <div className="deps-group">
      <h3 className="section-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className={`toggle-arrow ${isOpen ? 'open' : ''}`}>&#9654;</span>
        {title} ({deps.length})
      </h3>
      {isOpen && (
        <div className="dep-list">
          {deps.map((dep) => (
            <Link
              key={dep.dep_name}
              to="/package/$name"
              params={{ name: dep.dep_name }}
              className="dep-item"
            >
              <span className="dep-name">{dep.dep_name}</span>
              <span className="dep-version">{dep.dep_version}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleDependents({ dependents }: { dependents: DependentsResponse }) {
  const [isOpen, setIsOpen] = useState(dependents.count <= 15);
  const [showAll, setShowAll] = useState(false);

  if (dependents.count === 0) return null;

  const visible = showAll ? dependents.dependents : dependents.dependents.slice(0, 20);

  return (
    <div className="deps-group">
      <h3 className="section-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className={`toggle-arrow ${isOpen ? 'open' : ''}`}>&#9654;</span>
        Dependents ({dependents.count})
      </h3>
      {isOpen && (
        <div className="dep-list">
          {visible.map((dep, i) => (
            <Link
              key={`${dep.name}-${i}`}
              to="/package/$name"
              params={{ name: dep.name }}
              className="dep-item"
            >
              <span className="dep-name">{dep.name}</span>
              <span className="dep-version">{dep.dep_version}</span>
              <span className="badge badge-dep-type">{dep.dep_type}</span>
            </Link>
          ))}
          {!showAll && dependents.dependents.length > 20 && (
            <button className="show-more-btn" onClick={() => setShowAll(true)}>
              Show all {dependents.count} dependents
            </button>
          )}
        </div>
      )}
    </div>
  );
}
