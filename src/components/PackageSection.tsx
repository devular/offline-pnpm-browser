import { Link } from '@tanstack/react-router';
import { Badge } from './Badge';

export function PackageSection({
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
