import { createFileRoute, Link } from '@tanstack/react-router';
import { getPackageDetail, getDependents } from '../lib/packages.functions';
import type { PackageDetail, DependentsResponse } from '../lib/packages.functions';

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

function PackagePage() {
  const { pkg, dependents } = Route.useLoaderData();

  return (
    <div className="app">
      <header>
        <Link to="/" className="back-link">
          &larr; Back
        </Link>
        <div className="pkg-header">
          <h1>{pkg.name}</h1>
          <span className="pkg-version">{pkg.version}</span>
          {pkg.license && <span className="badge badge-license">{pkg.license}</span>}
        </div>
        {pkg.description && <p className="pkg-description">{pkg.description}</p>}
      </header>

      <main>
        <div className="pkg-meta-grid">
          <MetaCard label="Files" value={pkg.fileCount.toString()} />
          <MetaCard label="Size" value={formatBytes(pkg.totalSize)} />
          {pkg.author && <MetaCard label="Author" value={pkg.author} />}
          {pkg.homepage && <MetaCard label="Homepage" value={pkg.homepage} isLink />}
          {pkg.repository && <MetaCard label="Repository" value={pkg.repository} isLink />}
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

        {pkg.keywords.length > 0 && (
          <section className="pkg-detail-section">
            <h3>Keywords</h3>
            <div className="badge-list">
              {pkg.keywords.map((kw) => (
                <span key={kw} className="badge badge-keyword">
                  {kw}
                </span>
              ))}
            </div>
          </section>
        )}

        <DepsSection title="Dependencies" deps={pkg.dependencies.runtime} />
        <DepsSection title="Peer Dependencies" deps={pkg.dependencies.peer} />
        <DepsSection title="Dev Dependencies" deps={pkg.dependencies.dev} />
        <DepsSection title="Optional Dependencies" deps={pkg.dependencies.optional} />

        {dependents.count > 0 && (
          <section className="pkg-detail-section">
            <h3>Dependents ({dependents.count})</h3>
            <div className="dep-list">
              {dependents.dependents.slice(0, 50).map((dep, i) => (
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
              {dependents.count > 50 && (
                <p className="more-deps">and {dependents.count - 50} more…</p>
              )}
            </div>
          </section>
        )}

        {pkg.readme && (
          <section className="pkg-detail-section readme-section">
            <h3>README</h3>
            <pre className="readme-content">{pkg.readme}</pre>
          </section>
        )}
      </main>
    </div>
  );
}

function MetaCard({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="meta-card">
      <span className="meta-label">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="meta-value meta-link">
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
}: {
  title: string;
  deps: Array<{ dep_name: string; dep_version: string }>;
}) {
  if (deps.length === 0) return null;

  return (
    <section className="pkg-detail-section">
      <h3>
        {title} ({deps.length})
      </h3>
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
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
