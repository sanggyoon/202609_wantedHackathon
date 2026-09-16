import type { ButtonHTMLAttributes, ReactNode } from "react";
export function Button({
  secondary,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      type="button"
      className={`button ${secondary ? "secondary" : ""} ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
export function Heading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="heading">
      <small>{label}</small>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return <p className="notice">{children}</p>;
}
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
