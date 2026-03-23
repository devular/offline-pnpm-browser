import { createFileRoute, Link } from '@tanstack/react-router';
import { getCategoryDetail } from '@root/lib/packages.functions';
import { Badge } from '@root/components/Badge';

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
    <main className="page-content">
      <div className="page-title-row">
        <Link to="/" className="breadcrumb-link">
          Categories
        </Link>
        <span className="breadcrumb-sep">/</span>
        <h1 className="page-title">{category.name}</h1>
        <span className="page-count">{category.totalCount} packages</span>
      </div>

      {category.curated.length > 0 && (
        <PackageSection title="Curated" packages={category.curated} type="curated" />
      )}
      {category.discovered.length > 0 && (
        <PackageSection title="Discovered" packages={category.discovered} type="discovered" />
      )}
    </main>
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
          <Badge variant={type as 'curated' | 'discovered'}>{type}</Badge>
          <span className="pkg-name">{name}</span>
        </Link>
      ))}
    </section>
  );
}
