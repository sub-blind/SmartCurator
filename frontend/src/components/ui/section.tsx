import type { ReactNode } from "react";
import clsx from "clsx";

type SectionProps = {
  id?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Section({ id, title, eyebrow, description, children, className }: SectionProps) {
  return (
    <section id={id} className={clsx("surface-card space-y-6 rounded-3xl p-6 sm:p-8", className)}>
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]">{eyebrow}</p>}
        <h2 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && <p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">{description}</p>}
      </div>
      {children}
    </section>
  );
}
