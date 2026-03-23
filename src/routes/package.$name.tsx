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

function cleanRepoUrl(url: string): string {
  return url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^github\.com\//, '');
}

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

// --- Components ---

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

  return (
    <div className="app">
      <header className="pkg-page-header">
        <Link to="/" className="back-link">
          &larr; Back
        </Link>
        <div className="pkg-header">
          <h1>{pkg.name}</h1>
          <span className="pkg-version">{pkg.version}</span>
          {pkg.license && <span className="badge badge-license">{pkg.license}</span>}
        </div>
        {pkg.description && <p className="pkg-description">{pkg.description}</p>}
        {pkg.keywords.length > 0 && (
          <div className="pkg-keywords-inline">
            {pkg.keywords.map((kw) => (
              <span key={kw} className="badge badge-keyword">
                {kw}
              </span>
            ))}
          </div>
        )}
      </header>

      <main>
        <div className="pkg-meta-grid">
          <MetaCard label="Files" value={pkg.fileCount.toString()} />
          <MetaCard label="Size" value={formatBytes(pkg.totalSize)} />
          {pkg.author && <MetaCard label="Author" value={cleanAuthor(pkg.author)} />}
          {pkg.homepage && <MetaCard label="Homepage" value={pkg.homepage} isLink />}
          {pkg.repository && (
            <MetaCard
              label="Repository"
              value={repoDisplayUrl(pkg.repository)}
              href={repoHref(pkg.repository)}
              isLink
            />
          )}
        </div>

        {pkg.categories.length > 0 && (
          <section className="pkg-detail-section">
            <h3>Categories</h3>
            <div className="badge-list">
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
            </div>
          </section>
        )}

        <DepsSection title="Dependencies" deps={pkg.dependencies.runtime} defaultOpen />
        <DepsSection title="Peer Dependencies" deps={pkg.dependencies.peer} defaultOpen />
        <DepsSection
          title="Dev Dependencies"
          deps={pkg.dependencies.dev}
          defaultOpen={pkg.dependencies.dev.length <= 10}
        />
        <DepsSection
          title="Optional Dependencies"
          deps={pkg.dependencies.optional}
          defaultOpen={pkg.dependencies.optional.length <= 10}
        />

        <CollapsibleDependents dependents={dependents} />

        {readmeHtml && (
          <section className="pkg-detail-section readme-section">
            <h3>README</h3>
            <div className="readme-content" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
          </section>
        )}
        {pkg.readme && !readmeHtml && (
          <section className="pkg-detail-section readme-section">
            <h3>README</h3>
            <pre className="readme-content readme-raw">{pkg.readme}</pre>
          </section>
        )}
      </main>
    </div>
  );
}

function MetaCard({
  label,
  value,
  isLink,
  href,
}: {
  label: string;
  value: string;
  isLink?: boolean;
  href?: string;
}) {
  return (
    <div className="meta-card">
      <span className="meta-label">{label}</span>
      {isLink ? (
        <a
          href={href ?? value}
          target="_blank"
          rel="noopener noreferrer"
          className="meta-value meta-link"
        >
          {value.replace(/^https?:\/\//, '').slice(0, 50)}
        </a>
      ) : (
        <span className="meta-value">{value}</span>
      )}
    </div>
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
    <section className="pkg-detail-section">
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
    </section>
  );
}

function CollapsibleDependents({ dependents }: { dependents: DependentsResponse }) {
  const [isOpen, setIsOpen] = useState(dependents.count <= 15);
  const [showAll, setShowAll] = useState(false);

  if (dependents.count === 0) return null;

  const visible = showAll ? dependents.dependents : dependents.dependents.slice(0, 20);

  return (
    <section className="pkg-detail-section">
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
    </section>
  );
}
