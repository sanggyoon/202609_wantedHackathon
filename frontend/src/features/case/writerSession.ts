import { validToken, type CaseCreated } from "@/lib/api/cases";
const prefix = "bamtol:writer:";
// 같은 브라우저라면 탭을 새로 열어도 작성자(A)로 인식되도록 localStorage에 둔다.
// 신원 인증 수단은 아니다. 다른 기기에서는 B로 보인다.
export function checkWriterStorage() {
  const key = prefix + "check";
  localStorage.setItem(key, "1");
  localStorage.removeItem(key);
}
export function rememberWriter(value: CaseCreated) {
  localStorage.setItem(prefix + value.public_token, JSON.stringify({ token: value.writer_token, expires: value.expires_at }));
}
// 유효한 원문을 돌려주고, 만료·손상된 값은 그 저장소에서 지운다.
function readValid(storage: Storage, key: string): string | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw);
    if (validToken(v.token) && Number.isFinite(Date.parse(v.expires)) && Date.parse(v.expires) > Date.now()) return raw;
  } catch { /* 손상된 값은 아래에서 지운다. */ }
  storage.removeItem(key);
  return null;
}
export function getWriter(token: string): string | null {
  const key = prefix + token;
  try {
    let raw = readValid(localStorage, key);
    // 이전 버전은 탭 단위(sessionStorage)에 보관했다. 발견하면 한 번 옮긴다.
    if (raw === null) {
      raw = readValid(sessionStorage, key);
      if (raw !== null) {
        localStorage.setItem(key, raw);
        sessionStorage.removeItem(key);
      }
    }
    return raw === null ? null : JSON.parse(raw).token;
  } catch { return null; }
}
export function forgetWriter(token: string) {
  try { localStorage.removeItem(prefix + token); } catch { /* Storage may be disabled. */ }
  try { sessionStorage.removeItem(prefix + token); } catch { /* Storage may be disabled. */ }
}
