import { Collapsible } from './Collapsible';
import { DepItem } from './DepItem';

export function DepsSection({
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
