import { createFileRoute, Link } from '@tanstack/react-router';
import { getCategories, getDbStats } from '../lib/packages.functions';
import type { CategoriesResponse } from '../lib/packages.functions';
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

  return (
    <>
      <main className="home-main">
        <div className="home-hero">
          <h2 className="home-title">Browse {stats.unique_packages.toLocaleString()} packages</h2>
          <p className="home-subtitle">
            {stats.total_dependencies.toLocaleString()} dependency relationships indexed from your
            local pnpm store
          </p>
        </div>

        <CategoryGrid categories={categories} />
      </main>

      <footer className="status-bar">
        {stats.total_packages.toLocaleString()} total versions ·{' '}
        {stats.unique_packages.toLocaleString()} unique packages · {stats.total_categorized}{' '}
        categorized
      </footer>
    </>
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
