import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useRef, useEffect } from 'react';
import { marked, type MarkedExtension } from 'marked';
import { highlight } from 'sugar-high';
import { getPackageDetail, getDependents, getPackageVersions } from '@root/lib/packages.functions';
import type { DependentsResponse } from '@root/lib/packages.functions';
import { Badge } from '@root/components/Badge';
import { Collapsible } from '@root/components/Collapsible';
import { CopyButton } from '@root/components/CopyButton';
import { DepItem } from '@root/components/DepItem';
import { useCopy } from '@root/hooks/useCopy';

type PackageSearch = { v?: string };

export const Route = createFileRoute('/package/$name')({
  validateSearch: (search: Record<string, unknown>): PackageSearch => ({
    v: typeof search.v === 'string' ? search.v : undefined,
  }),
  loaderDeps: ({ search }) => ({ version: search.v }),
  loader: async ({ params, deps }) => {
    const [pkg, dependents, versions] = await Promise.all([
      getPackageDetail({ data: { name: params.name, version: deps.version } }),
      getDependents({ data: params.name }),
      getPackageVersions({ data: params.name }),
    ]);
    if (!pkg) throw new Error('Package not found');
    return { pkg, dependents, versions };
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
          return `<pre class="sh-code" id="${id}">${langLabel}<code>${highlighted}</code><button class="copy-btn copy-btn-code" data-copy-target="${id}" aria-label="Copy code">Copy</button></pre>`;
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
      navigator.clipboard.writeText(code.textContent ?? '').then(() => {
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

// --- Install command ---

function InstallCommand({ name, version }: { name: string; version: string }) {
  const cmd = `pnpm add ${name}@${version} --offline`;
  const { copy, copied } = useCopy();

  return (
    <div className="install-cmd" onClick={() => copy(cmd)}>
      <code className="install-cmd-text">
        <span className="install-cmd-prompt">$</span> {cmd}
      </code>
      <span className={`install-cmd-action ${copied ? 'install-cmd-copied' : ''}`}>
        {copied ? 'Copied' : 'Click to copy'}
      </span>
    </div>
  );
}

// --- Version selector ---

function VersionSelector({
  currentVersion,
  versions,
  packageName,
}: {
  currentVersion: string;
  versions: Array<{ id: number; version: string }>;
  packageName: string;
}) {
  const navigate = useNavigate();

  if (versions.length <= 1) {
    return <span className="pkg-ver">{currentVersion}</span>;
  }

  return (
    <div className="version-select-wrap">
      <select
        className="version-select"
        value={currentVersion}
        onChange={(e) => {
          const newVersion = e.target.value;
          navigate({
            to: '/package/$name',
            params: { name: packageName },
            search: { v: newVersion },
          });
        }}
        aria-label="Package version"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.version}>
            {v.version}
          </option>
        ))}
      </select>
      <span className="version-count">{versions.length} versions</span>
    </div>
  );
}

// --- Dep sections ---

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
