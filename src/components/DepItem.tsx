import { Link } from '@tanstack/react-router';
import { Badge } from './Badge';

interface DepItemProps {
  name: string;
  version: string;
  type?: string;
}

export function DepItem({ name, version, type }: DepItemProps) {
  return (
    <Link to="/package/$name" params={{ name }} className="dep-item">
      <span className="dep-name">{name}</span>
      <span className="dep-version">{version}</span>
      {type && <Badge variant="dep-type">{type}</Badge>}
    </Link>
  );
}
