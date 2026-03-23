import { useState, type ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Collapsible({ title, count, defaultOpen = true, children }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="deps-group">
      <h3 className="section-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className={`toggle-arrow ${isOpen ? 'open' : ''}`}>&#9654;</span>
        {title} ({count})
      </h3>
      {isOpen && children}
    </div>
  );
}
