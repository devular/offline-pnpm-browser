import { useState } from 'react';
import { Collapsible } from './Collapsible';
import { DepItem } from './DepItem';
import type { DependentsResponse } from '@root/lib/packages.functions';

export function CollapsibleDependents({ dependents }: { dependents: DependentsResponse }) {
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
