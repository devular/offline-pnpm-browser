import { Link } from '@tanstack/react-router';
import type { CategoriesResponse } from '@root/lib/packages.functions';

export function CategoryGrid({ categories }: { categories: CategoriesResponse }) {
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
