import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { marked, type MarkedExtension } from 'marked';
import { highlight } from 'sugar-high';
import { getPackageDetail, getDependents } from '../lib/packages.functions';
import type { DependentsResponse } from '../lib/packages.functions';
import { Badge, Collapsible, DepItem } from '../components';

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
      const renderer: MarkedExtension = {
        renderer: {
          code({ text, lang }) {
            const highlighted = highlight(text);
            const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
            return `<pre class="sh-code">${langLabel}<code>${highlighted}</code></pre>`;
          },
        },
      };
      return marked.use(renderer).parse(pkg.readme, { async: false }) as string;
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
      <section className="pkg-identity">
        <div className="pkg-name-row">
          <h1 className="pkg-title">{pkg.name}</h1>
          <span className="pkg-ver">{pkg.version}</span>
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
        <section className="pkg-readme">
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
  if (deps.length === 0) return null;

  return (
    <Collapsible title={title} count={deps.length} defaultOpen={defaultOpen}>
      <div className="dep-list">
        {deps.map((dep) => (
          <DepItem key={dep.dep_name} name={dep.dep_name} version={dep.dep_version} />
        ))}
      </div>
    </Collapsible>
  );
}

function CollapsibleDependents({ dependents }: { dependents: DependentsResponse }) {
  const [showAll, setShowAll] = useState(false);

  if (dependents.count === 0) return null;

  const visible = showAll ? dependents.dependents : dependents.dependents.slice(0, 20);

  return (
    <Collapsible title="Dependents" count={dependents.count} defaultOpen={dependents.count <= 15}>
      <div className="dep-list">
        {visible.map((dep, i) => (
          <DepItem
            key={`${dep.name}-${i}`}
            name={dep.name}
            version={dep.dep_version}
            type={dep.dep_type}
          />
        ))}
        {!showAll && dependents.dependents.length > 20 && (
          <button className="show-more-btn" onClick={() => setShowAll(true)}>
            Show all {dependents.count} dependents
          </button>
        )}
      </div>
    </Collapsible>
  );
}
