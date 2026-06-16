// Presentacionais compartilhados (sem estado): usados pelos forms client
// (ProfileForm/PasswordForm) e pelo ProjectsManager. Por isso NÃO levam "use client".

export function CardShell({
  title,
  children,
  headerExtra,
  footer,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-sm bg-surface-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-5">
        <h2 className="font-display text-base font-bold text-foreground-primary">
          {title}
        </h2>
        {headerExtra}
      </div>
      {children}
      {footer && (
        <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}

export function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="font-body text-xs font-medium text-foreground-primary">
        {label}
      </span>
      <span className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary">
        {icon}
        {value}
      </span>
    </div>
  );
}
