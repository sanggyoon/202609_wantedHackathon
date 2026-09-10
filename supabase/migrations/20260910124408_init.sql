-- 초기 마이그레이션: UUID 생성용 확장만 활성화.
-- 실제 테이블 스키마(사건/진술/판정 등)는 데이터 모델 확정 후 후속 마이그레이션에서 추가.
create extension if not exists pgcrypto with schema extensions;
