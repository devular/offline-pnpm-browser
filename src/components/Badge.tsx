import type { ReactNode } from 'react';

type BadgeVariant = 'curated' | 'discovered' | 'license' | 'keyword' | 'dep-type';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
