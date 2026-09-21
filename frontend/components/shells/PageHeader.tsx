/**
 * Section header used at the top of every portal page.
 *
 * Headline plus one line of body, stacked. No eyebrow labels and no floating
 * right-hand explainer paragraph - the nav already says where you are.
 */
export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rise mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
