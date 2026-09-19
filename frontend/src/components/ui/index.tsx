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
  label?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="heading">
      {label && <small>{label}</small>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
// role을 주면 채팅 화면에서도 숨기지 않는다 (globals.css의 body.chat-open 규칙).
export function Notice({
  children,
  role,
}: {
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <p className="notice" role={role}>
      {children}
    </p>
  );
}
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
