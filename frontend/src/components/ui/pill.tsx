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
          ? "bg-brand/20 text-blue-200 ring-1 ring-blue-500/30"
          : "bg-white/10 text-slate-200"
      )}
    >
      {label}
    </span>
  );
}




