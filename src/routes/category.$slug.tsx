import { createFileRoute, Link } from '@tanstack/react-router';
import { getCategoryDetail } from '../lib/packages.functions';

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const category = await getCategoryDetail({ data: params.slug });
    if (!category) throw new Error('Category not found');
    return category;
  },
  component: CategoryPage,
});

function CategoryPage() {
  const category = Route.useLoaderData();

  return (
    <div className="app">
      <header>
        <Link to="/" className="back-link">
          &larr; All categories
        </Link>
        <h1>{category.name}</h1>
        <p className="subtitle">{category.totalCount} packages</p>
      </header>

      <main>
        {category.curated.length > 0 && (
          <PackageSection title="Curated" packages={category.curated} type="curated" />
        )}
        {category.discovered.length > 0 && (
          <PackageSection title="Discovered" packages={category.discovered} type="discovered" />
        )}
      </main>
    </div>
  );
}

function PackageSection({
  title,
  packages,
  type,
}: {
  title: string;
  packages: string[];
  type: string;
}) {
  return (
    <section className="pkg-section">
      <h4>
        {title} ({packages.length})
      </h4>
      {packages.map((name) => (
        <Link key={name} to="/package/$name" params={{ name }} className="pkg-item">
          <span className={`badge badge-${type}`}>{type}</span>
          <span className="pkg-name">{name}</span>
        </Link>
      ))}
    </section>
  );
}
