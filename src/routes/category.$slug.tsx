import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { getBrowserCategoryDetail } from '@root/lib/browser/categories';
import { PackageSection } from '@root/components/PackageSection';

export const Route = createFileRoute('/category/$slug')({
  loader: ({ params }) => {
    const category = getBrowserCategoryDetail(params.slug);
    if (!category) throw notFound();
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
