import { validToken, type CaseCreated } from "@/lib/api/cases";
const prefix = "bamtol:writer:";
export function checkWriterStorage() {
  const key = prefix + "check";
  sessionStorage.setItem(key, "1");
  sessionStorage.removeItem(key);
}
export function rememberWriter(value: CaseCreated) {
  sessionStorage.setItem(prefix + value.public_token, JSON.stringify({ token: value.writer_token, expires: value.expires_at }));
}
export function getWriter(token: string): string | null {
  try {
    const raw = sessionStorage.getItem(prefix + token);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!validToken(v.token) || !Number.isFinite(Date.parse(v.expires)) || Date.parse(v.expires) <= Date.now()) {
      sessionStorage.removeItem(prefix + token);
      return null;
    }
    return v.token;
  } catch { return null; }
}
export function forgetWriter(token: string) {
  try { sessionStorage.removeItem(prefix + token); } catch { /* Storage may be disabled. */ }
}
