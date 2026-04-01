import clsx from "clsx";

type PillProps = {
  label: string;
  variant?: "default" | "accent";
};

export function Pill({ label, variant = "default" }: PillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        variant === "accent"
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-1 ring-[var(--border-strong)]"
          : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
      )}
    >
      {label}
    </span>
  );
}
