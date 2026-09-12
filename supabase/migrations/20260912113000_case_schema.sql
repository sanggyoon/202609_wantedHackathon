-- 사건 스키마: 열거형, 테이블 4개, 인덱스, RLS.
-- 설계 근거: docs/Supabase_Schema_Design.md §4·§5, docs/Data_Flow.md §6
--
-- 영속 저장하는 것은 "생성 결과물"과 사건 메타데이터뿐이다.
-- AI 대화 원문을 담는 컬럼·테이블은 의도적으로 존재하지 않는다.
-- 담을 곳이 없으므로 "실수로 저장"이 구조적으로 불가능하다.


-- ---------------------------------------------------------------------------
-- 1. 열거형
-- ---------------------------------------------------------------------------

-- PRD §6 "사건 상태" 표와 값이 1:1로 대응한다.
create type case_status as enum (
  'DRAFT',
  'AWAITING_RESPONSE',
  'COUNTER_DRAFT',
  'COUNTER_COMPLETED',
  'APOLOGY_DRAFT',
  'APOLOGY_COMPLETED',
  'EXPIRED'
);

create type case_response_type as enum ('COUNTER', 'APOLOGY');

create type statement_side as enum ('A', 'B');


-- ---------------------------------------------------------------------------
-- 2. cases (D1) — 사건 메타데이터
-- ---------------------------------------------------------------------------
--
-- A의 시작 요청 시점에 status='DRAFT'로 생성된다. 링크를 발급하려면 토큰
-- 해시로 조회할 행이 먼저 존재해야 하기 때문이다 (Data_Flow.md §6).
--
-- gen_random_uuid()는 PG13+ 코어(pg_catalog) 내장 함수라, pgcrypto가
-- extensions 스키마에 설치돼 있어도 search_path와 무관하게 동작한다.

create table cases (
  id                uuid        primary key default gen_random_uuid(),

  -- URL 토큰의 SHA-256 hex. 토큰 원문은 저장하지 않는다.
  public_token_hash text        not null unique,

  status            case_status not null default 'DRAFT',

  -- B가 사과와 맞고소 중 무엇을 택했는지. 선택 전에는 null.
  response_type     case_response_type,

  created_at        timestamptz not null default now(),

  -- B의 최종 답변 시각. 미답변 사건에서는 null로 남는다.
  answered_at       timestamptz,

  -- 생성 시 created_at + 7일로 시작하고, B의 최종 답변 시
  -- answered_at + 7일로 갱신된다.
  -- 초기값을 두는 이유: "최종 답변 기준"만 적용하면 B가 영영 답하지 않은
  -- 사건에 만료 시각이 없어 영구히 남는다.
  expires_at        timestamptz not null default (now() + interval '7 days'),

  -- 결과물 물리 삭제가 완료된 시각. 검수에서 삭제 완료의 증거로 쓴다.
  purged_at         timestamptz
);

comment on table cases is
  '사건 메타데이터. 만료 시 결과물만 삭제하고 이 행은 EXPIRED로 남겨 토큰 재사용을 막는다.';

-- 만료 배치가 전체 스캔을 하지 않도록 하는 부분 인덱스.
-- 이미 만료된 행은 다시 조회할 일이 없으므로 인덱스에서 제외한다.
create index cases_expires_at_idx
  on cases (expires_at)
  where status <> 'EXPIRED';


-- ---------------------------------------------------------------------------
-- 3. statement_cards (D2) — A/B 고소장 카드
-- ---------------------------------------------------------------------------
--
-- AI가 대화 원문에서 추출·구조화한 결과물이다. 원문 자체는 포함하지 않는다.

create table statement_cards (
  id                   uuid           primary key default gen_random_uuid(),
  case_id              uuid           not null references cases (id) on delete cascade,
  side                 statement_side not null,

  cute_charge          text           not null,           -- 귀여운 죄명
  incident_summary     text           not null,           -- 사건 한 줄 요약
  incident_description text           not null,           -- 정리된 사건 내용
  emotions             text[]         not null default '{}',
  emotion_reason       text           not null,
  different_viewpoint  text,                              -- PRD §11에서 유일한 nullable 필드
  desired_outcome      text           not null,

  created_at           timestamptz    not null default now(),

  -- 한 사건에서 A·B가 각각 1장. 중복 제출을 DB가 막는다.
  -- 이 UNIQUE가 만드는 인덱스가 case_id 조회와 cascade 삭제까지 커버하므로
  -- case_id 단독 인덱스는 따로 두지 않는다.
  unique (case_id, side)
);


-- ---------------------------------------------------------------------------
-- 4. apologies (D3) — B의 사과 카드
-- ---------------------------------------------------------------------------
--
-- case_id를 기본키로 둬서 "사건당 1장"이 DB 차원에서 강제된다.
-- 별도 제약 없이 1회 제출·즉시 잠금이 보장된다.

create table apologies (
  case_id           uuid        primary key references cases (id) on delete cascade,

  -- B가 입력한 텍스트 그대로. AI가 없는 약속·인정 내용을 만들어 섞으면
  -- 안 된다 (PRD §13, Data_Flow.md §8.2).
  body              text        not null,
  understood_point  text,
  future_commitment text,

  submitted_at      timestamptz not null default now()
);

comment on table apologies is
  'B가 직접 작성한 사과문. AI 생성물이 아니며 파생 필드를 주입하지 않는다.';


-- ---------------------------------------------------------------------------
-- 5. mediation_reports (D4) — 중재 리포트
-- ---------------------------------------------------------------------------
--
-- A·B 두 카드를 입력으로 AI가 생성한 결과물. apologies와 같은 이유로
-- case_id를 기본키로 둔다.

create table mediation_reports (
  case_id                   uuid        primary key references cases (id) on delete cascade,

  common_ground             text[]      not null default '{}',
  different_views           text[]      not null default '{}',
  hurt_points_a             text[]      not null default '{}',
  hurt_points_b             text[]      not null default '{}',
  possible_misunderstanding text,
  conversation_starter      text        not null,

  created_at                timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- 6. RLS — service_role 단독 접근
-- ---------------------------------------------------------------------------
--
-- RLS를 켜되 정책을 하나도 만들지 않는다. 정책이 없으면 모든 행이 거부되므로
-- anon·authenticated 키로는 아무것도 읽고 쓸 수 없고, RLS를 우회하는
-- service_role만 통과한다. 접근자는 FastAPI 단독이다.
--
-- 프론트에 anon 키가 실수로 노출돼도 데이터가 새지 않는다.
--
-- "링크가 곧 권한"은 DB가 아니라 FastAPI가 토큰 해시로 조회하는 계층에서
-- 구현한다. RLS로 토큰을 검증하려면 요청마다 세션 변수를 세팅해야 해서
-- 단일 접근자 구조에서는 복잡도만 늘어난다.

alter table cases             enable row level security;
alter table statement_cards   enable row level security;
alter table apologies         enable row level security;
alter table mediation_reports enable row level security;
