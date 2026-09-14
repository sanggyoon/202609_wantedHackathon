import hashlib
import hmac
import secrets

# 링크 토큰. 추측이 어려워야 하며(PRD §7) URL에 그대로 들어간다.
TOKEN_BYTES = 32


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    """토큰 원문은 어디에도 저장하지 않는다. 해시만 DB에 남는다 (DFD §2-4)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def token_matches(token: str, expected_hash: str) -> bool:
    """타이밍 공격을 피하려면 해시 비교도 상수 시간이어야 한다."""
    return hmac.compare_digest(hash_token(token), expected_hash)
