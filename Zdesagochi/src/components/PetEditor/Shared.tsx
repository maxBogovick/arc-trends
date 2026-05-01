import React from 'react';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-bold text-sm text-lumio-text tracking-wide">{children}</h3>
  );
}
