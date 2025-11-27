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
    <section id={id} className={clsx("space-y-6 rounded-3xl p-6 sm:p-8 glass-card", className)}>
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{eyebrow}</p>}
        <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
        {description && <p className="mt-2 text-sm text-slate-300">{description}</p>}
      </div>
      {children}
    </section>
  );
}




