-- API 연결에 필요한 컬럼 추가.
-- 근거: docs/API_Design.md §8-1 (카드 형태를 DB 기준으로 통일), §6.1 (쓰기 토큰)
--
-- 넷 다 nullable이고 기존 행이 없어 백필이 필요 없다.

-- A의 쓰기 권한 검증용. 사건 생성 시 발급한 writer_token의 SHA-256 hex.
alter table cases add column writer_token_hash text;

-- 프론트에 이미 구현돼 있으나 담길 곳이 없던 항목들.
-- ShareSelectScreen이 사용자에게 공유 여부를 고르게 하는 대상이다.
alter table statement_cards add column hurt_point        text;  -- 서운했던 지점
alter table statement_cards add column expected_behavior text;  -- 그때 기대했던 행동
alter table statement_cards add column assumption        text;  -- 사실로 확인되지 않은 추측

-- 사과문의 "인정한 점". ApologyScreen이 입력받으나 담길 곳이 없었다.
alter table apologies add column admitted_point text;

comment on column statement_cards.assumption is
  '사용자의 추측. 사실이 아닐 수 있으므로 사실로 단정해 표시하지 않는다 (PRD §13).';
comment on column cases.writer_token_hash is
  'A의 쓰기 권한 토큰 해시. 원문은 발급 응답에서만 노출된다.';
