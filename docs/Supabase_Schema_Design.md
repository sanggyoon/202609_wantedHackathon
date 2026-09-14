# Supabase 스키마 설계 (MVP)

> 프로젝트: 문철빵 · 작성일: 2026-09-12 · 상태: Accepted
>
> 근거 문서: `docs/PRD.md` §11(데이터 구조)·§15(MVP 범위),
> `docs/Tech_ADR.md` §6(Supabase Cloud)·§10(마이그레이션 도구),
> `docs/Data_Flow.md` v0.2 (이하 **DFD**)

---

## 1. 목적과 범위

MVP에 필요한 Postgres 스키마를 확정하고, `supabase/migrations/`에 적용할
SQL 파일의 내용을 명세한다.

**범위에 포함:** 테이블·타입·제약·인덱스, RLS 정책, 만료 삭제 잡, 마이그레이션 파일 구성.

**범위에서 제외:** FastAPI의 쿼리 계층, API 엔드포인트, 만료 lazy 검사 구현,
프론트엔드 상태 관리. 이들은 이 스키마를 전제로 별도 작업에서 다룬다.

---

## 2. 설계 결정

착수 전 확정한 사항이다. 괄호 안은 근거가 된 미결 항목.

| # | 결정 | 근거 |
|---|---|---|
| D-1 | `expires_at`은 **최종 답변 시각 + 7일**. 단 생성 시 `created_at + 7일`로 초기화하고, B의 최종 답변 시 갱신 | DFD §7.3. 답변 기준만 쓰면 미답변 사건이 만료되지 않음 |
| D-2 | 만료 삭제는 **pg_cron**이 실행 | DFD §7.3. ADR §10의 "백엔드에 인프라를 쌓지 않는다" 방향과 일치 |
| D-3 | B의 답변은 **1회만 허용, 제출 즉시 읽기 전용**. DB 제약으로 강제 | DFD §7.2 |
| D-4 | 링크 폐기 기능은 **MVP 제외** | PRD §15에 없음. 추후 `DISCARDED` 상태 추가는 무중단 |
| D-5 | 원문 임시 저장 테이블을 **만들지 않음** (서버 무저장) | DFD §7.1 확정 사항. 검수 항목 "스키마에 원문 컬럼 부재"가 구조적으로 충족됨 |
| D-6 | 토큰은 **SHA-256 hex를 `text`로** 저장, unique. 만료 후에도 `cases` 행은 유지 | DFD §2-4, §7.3. 토큰 재사용 방지 |
| D-7 | DB 접근자는 **FastAPI 단독**. 브라우저는 Supabase에 직접 붙지 않음 | `backend/.env.example`에 service role key 존재, `frontend/`에 Supabase 클라이언트 부재 |

### 해소한 문서 간 모순

DFD §5(Level 1 DFD)는 `P1. 사건/링크 발급`이 `status=DRAFT`로 D1을 생성한다고
표시하지만, DFD §6(데이터 스토어 정의) 표는 D1의 생성 시점을 "A가 고소장 확정 시"로
적었다.

**§5를 채택한다.** 링크를 먼저 발급하려면 토큰 해시로 조회할 행이 이미 존재해야 하므로
§6 표가 부정확하다. DFD §7.2 표의 "`DRAFT` — 쓰는 데이터: 없음"도 같은 맥락에서
"**결과물**을 저장하지 않는다"로 읽는다. 사건 행 자체는 존재한다.

---

## 3. 데이터 모델

```
cases (D1)
 ├─ statement_cards   (D2)  UNIQUE(case_id, side)  — A/B 각 1장
 ├─ apologies         (D3)  PK = case_id           — 사건당 1장
 └─ mediation_reports (D4)  PK = case_id           — 사건당 1장
```

모든 자식 테이블은 `case_id`로 `cases`를 참조하며 `on delete cascade`다.
DFD §6의 "사건 삭제 시 연쇄 삭제" 요구를 만족한다.

`apologies`와 `mediation_reports`는 `case_id`를 **기본키로** 둔다. 별도 유니크
제약 없이 "사건당 1건"이 강제되어 D-3(1회 제출)이 앱 코드 없이 보장된다.
`statement_cards`는 A·B 두 장이므로 `UNIQUE(case_id, side)`로 같은 효과를 낸다.

배열 필드는 Postgres `text[]`를 쓴다. PRD §11의 `string[]`·`text[]` 표기와 1:1로
대응하고, JSONB보다 제약이 명확하다.

### PRD §11에서 추가한 컬럼

| 컬럼 | 테이블 | 이유 |
|---|---|---|
| `answered_at` | `cases` | D-1의 만료 기준 시각을 기록 |
| `purged_at` | `cases` | 삭제가 실제로 완료됐는지 DFD §9 검수로 확인 |
| `created_at` | `statement_cards`, `mediation_reports` | 생성 순서 추적 (디버깅용) |

### 저장하지 않는 것

AI 대화 원문, 생성 전 임시 답변, 원문이 포함된 로그·분석 이벤트를 담는 컬럼과
테이블은 존재하지 않는다 (D-5). 이는 선택이 아니라 스키마의 구조적 속성이다.

---

## 4. DDL

### 4.1 열거형

```sql
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
```

값은 PRD §6 "사건 상태" 표와 정확히 일치한다.

### 4.2 cases

```sql
create table cases (
  id                uuid        primary key default gen_random_uuid(),
  public_token_hash text        not null unique,
  status            case_status not null default 'DRAFT',
  response_type     case_response_type,
  created_at        timestamptz not null default now(),
  answered_at       timestamptz,
  expires_at        timestamptz not null default (now() + interval '7 days'),
  purged_at         timestamptz
);

create index cases_expires_at_idx
  on cases (expires_at)
  where status <> 'EXPIRED';
```

부분 인덱스는 만료 잡이 전체 스캔을 하지 않도록 한다. 이미 만료된 행은
다시 조회할 일이 없으므로 인덱스에서 제외한다.

`gen_random_uuid()`는 기존 마이그레이션 `20260910124408_init.sql`이 활성화한
`pgcrypto`에 의존한다.

### 4.3 statement_cards

```sql
create table statement_cards (
  id                   uuid           primary key default gen_random_uuid(),
  case_id              uuid           not null references cases(id) on delete cascade,
  side                 statement_side not null,
  cute_charge          text           not null,
  incident_summary     text           not null,
  incident_description text           not null,
  emotions             text[]         not null default '{}',
  emotion_reason       text           not null,
  different_viewpoint  text,
  desired_outcome      text           not null,
  created_at           timestamptz    not null default now(),
  unique (case_id, side)
);
```

`different_viewpoint`만 nullable이다. PRD §11에서 `text/null`로 표기된 유일한 필드다.

`case_id` 단독 인덱스는 두지 않는다. `UNIQUE(case_id, side)`가 만드는 btree 인덱스의
선두 컬럼이 `case_id`이므로, `where case_id = ?` 조회와 FK cascade 삭제를 이미 커버한다.
별도 인덱스는 쓰기 비용만 늘리는 중복이다.

### 4.4 apologies

```sql
create table apologies (
  case_id            uuid        primary key references cases(id) on delete cascade,
  body               text        not null,
  understood_point   text,
  future_commitment  text,
  submitted_at       timestamptz not null default now()
);
```

`body`는 B가 입력한 텍스트를 **그대로** 저장한다. AI 파생 필드를 넣지 않는다
(PRD §13, DFD §8.2의 검수 포인트).

### 4.5 mediation_reports

```sql
create table mediation_reports (
  case_id                  uuid        primary key references cases(id) on delete cascade,
  common_ground            text[]      not null default '{}',
  different_views          text[]      not null default '{}',
  hurt_points_a            text[]      not null default '{}',
  hurt_points_b            text[]      not null default '{}',
  possible_misunderstanding text,
  conversation_starter     text        not null,
  created_at               timestamptz not null default now()
);
```

### 4.6 제약에 대한 방침

위에 명시한 것 외에 상태 전이를 강제하는 CHECK 제약은 두지 않는다
(예: "`COUNTER_COMPLETED`면 `answered_at`이 not null"). 3주 일정에서 상태 머신이
아직 흔들릴 수 있고, 과도한 제약은 정당한 전이를 막아 디버깅 비용을 키운다.

**상태 전이는 FastAPI가 조건부 UPDATE로 처리한다:**

```sql
update cases set status = 'COUNTER_COMPLETED', answered_at = now(),
                 expires_at = now() + interval '7 days'
 where id = $1 and status = 'COUNTER_DRAFT';
```

영향 행이 0이면 이미 전이된 것이므로 중복 제출로 간주한다. 결과물 테이블의
PK·UNIQUE 제약이 최후의 방어선이다 (D-3).

---

## 5. 접근 제어 (RLS)

```sql
alter table cases             enable row level security;
alter table statement_cards   enable row level security;
alter table apologies         enable row level security;
alter table mediation_reports enable row level security;
```

**정책을 하나도 만들지 않는다.** RLS가 켜졌는데 정책이 없으면 모든 행이 거부되므로
`anon`·`authenticated` 키로는 아무것도 읽고 쓸 수 없다. `service_role`은 RLS를
우회하므로 FastAPI만 접근한다 (D-7).

프론트에 anon 키가 실수로 노출되어도 데이터가 새지 않는다.

DFD §2-4 "링크가 곧 권한"은 DB가 아니라 **FastAPI가 토큰 해시로 조회하는 계층**에서
구현한다. RLS로 토큰을 검증하려면 요청마다 세션 변수를 세팅해야 해서, 단일 접근자
구조에서는 복잡도만 늘어난다.

---

## 6. 만료·삭제

### 6.1 삭제 함수

```sql
create or replace function purge_expired_cases()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids
    from cases
   where expires_at <= now()
     and status <> 'EXPIRED';

  if v_ids is null then
    return 0;
  end if;

  delete from statement_cards   where case_id = any(v_ids);
  delete from apologies         where case_id = any(v_ids);
  delete from mediation_reports where case_id = any(v_ids);

  update cases
     set status = 'EXPIRED',
         purged_at = now()
   where id = any(v_ids);

  return array_length(v_ids, 1);
end;
$$;

revoke all on function purge_expired_cases() from public, anon, authenticated;
```

`cases` 행은 남기고 결과물만 지운다 (D-6, DFD §7.3 "삭제 범위" 표).
`purged_at`이 삭제 완료의 증거가 된다.

### 6.2 스케줄

```sql
create extension if not exists pg_cron;

select cron.unschedule('purge-expired-cases')
 where exists (select 1 from cron.job where jobname = 'purge-expired-cases');

select cron.schedule(
  'purge-expired-cases',
  '0 * * * *',
  $$select public.purge_expired_cases()$$
);
```

매시 정각 실행. `unschedule` 가드로 재실행해도 중복 등록되지 않는다.

**적용 결과 (2026-09-12).** 무료 플랜에서도 `pg_cron` 확장이 정상 활성화됐다. 원격 스키마
덤프에 `CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog"`로 나타난다 —
스키마를 명시하지 않았는데 Supabase가 `pg_catalog`에 배치했다. 우려했던 설치 스키마 제약은
실제로 문제가 되지 않았다. (동작하지 않은 것은 Branching이었다 — ADR §10 참고)

### 6.3 lazy 검사 (이번 범위 밖)

배치는 최대 1시간 지연되므로, 그 틈은 **FastAPI가 조회 시점에 `expires_at`을
확인**해서 막아야 한다. 만료됐으면 내용 없이 만료 응답을 반환한다.
DFD §7.3의 "접근 시점 검사 + 배치 삭제 병행" 권장안이다.

이 스키마 작업에는 포함되지 않으며, API 구현 시 반드시 함께 들어가야 한다.

---

## 7. 마이그레이션 파일 구성

| 순서 | 파일 | 내용 | 상태 |
|---|---|---|---|
| 1 | `20260910124408_init.sql` | `pgcrypto` 확장 | 적용됨 |
| 2 | `20260912113000_case_schema.sql` | §4 열거형·테이블·인덱스, §5 RLS | 적용됨 |
| 3 | `20260912113100_expiry_purge.sql` | §6 pg_cron·함수·스케줄 | 적용됨 |
| 4 | `<타임스탬프>_align_api_schema.sql` | API 연결에 필요한 컬럼 4개 (아래) | **예정** |

### 4번 — API 연결에 필요한 컬럼 (2026-09-14 결정)

```sql
alter table cases           add column writer_token_hash text;
alter table statement_cards add column expected_behavior text;
alter table statement_cards add column assumption        text;
alter table apologies       add column admitted_point     text;
```

`writer_token_hash`는 A의 쓰기 권한 검증에 쓴다(`docs/API_Design.md` §6.1).

나머지 셋은 **프론트에 이미 구현된 기능이 DB에 담길 곳이 없어서** 추가한다. 공유 항목
선택 화면(`ShareSelectScreen.tsx`)이 사용자에게 "기대했던 행동"·"추측"을 공유할지 고르게
하고, 사과문 화면은 "인정한 점"을 받는다. 카드 형태를 DB 기준으로 통일하기로 하면서
(`docs/API_Design.md` §8-1) 이 셋을 DB가 흡수한다.

넷 다 nullable이고 기존 행이 없어 백필이 불필요하다.

**PRD §11 데이터 구조 초안에는 없던 필드다.** 초안 이후 프론트에서 늘어난 기능이므로
PRD도 함께 갱신하는 것이 맞다.

**2와 3을 분리한 이유:** `pg_cron` 활성화가 설치 스키마 제약으로 실패할 여지가 있다고
보아, 3이 깨져도 2는 적용된 상태로 남도록 나눴다. 실제 적용에서는 **3도 문제없이 통과**해
이 대비는 쓰이지 않았지만(§6.2), 분리 자체는 유지한다 — 스키마 정의와 스케줄링은 성격이
다른 변경이고, 나중에 스케줄만 조정할 때 이력이 섞이지 않는다.

타임스탬프는 기존 `20260910124408`보다 크므로 순서가 보장된다.

---

## 8. 적용 절차

ADR §10에 따라 **Supabase CLI**로 적용한다.

1. 브랜치에서 마이그레이션 파일 추가
2. PR 생성 → CI(lint/build)만 돌고 **DB 검증은 없음**
3. 머지
4. **마이그레이션을 추가한 사람이 `supabase db push` 실행**

> **머지만으로는 DB가 바뀌지 않는다.** 무료 플랜에서는 GitHub 연동의 자동 적용과 Preview
> Branch가 동작하지 않는다(ADR §10 "발견 경위" 참고). 4단계를 빠뜨리면 코드와 스키마가
> 어긋나고, 다른 팀원은 원인을 찾기 어려운 오류를 만난다.

적용 후 검증:

```bash
supabase migration list       # 로컬·원격 버전이 일치하는지
supabase db diff --linked     # "No schema changes found"면 drift 없음
```

SQL 에디터로 프로덕션 스키마를 직접 고치지 않는다. 마이그레이션 파일과 실제 스키마가
어긋나면(drift) 이후 모든 적용이 불안정해진다. `db diff --linked`가 그 감지 수단이다.

### 적용 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-09-12 | `init.sql`·`case_schema`·`expiry_purge` 3개를 `supabase db push`로 최초 적용. 검증 완료 (§9 참고) |

---

## 9. 검수 대응 (DFD §9)

| 검수 항목 | 이 설계가 만족하는 방식 |
|---|---|
| 원문이 DB에 저장되지 않는다 | 원문 컬럼·테이블이 스키마에 존재하지 않음 (D-5) |
| 생성된 결과물만 보관된다 | 영속 테이블이 `cases` + 결과물 3개뿐 |
| 같은 URL이 답변 후에도 안 바뀐다 | `public_token_hash` 불변, `status`만 전이 |
| 만료 후 내용이 노출되지 않는다 | pg_cron 물리 삭제 + `purged_at` 기록. lazy 검사는 API 몫 |
| 사과문이 그대로 표시된다 | `apologies.body`에 AI 파생 필드 없음 |
| 중복 제출 방지 | PK·UNIQUE 제약 + 조건부 UPDATE (D-3) |

**로그·분석 이벤트에 원문 미포함**은 스키마로 보장할 수 없다. FastAPI 구현 시
별도로 확인해야 한다.

---

## 10. 남은 미결 사항

이 스키마 작업의 선행 조건은 아니지만, 서비스 오픈 전 확정이 필요하다.

1. 만료 후 캐시·백업 삭제 완료 허용 시간 (DFD §10-1)
2. 외부 AI 제공자의 요청 보관·학습 정책, 무보관 옵션 적용 여부 (DFD §10-2, §10-3)
3. 작성 중 임시 저장을 브라우저 로컬에 둘지 여부 (DFD §10-4 — 서버 무저장은 확정)
4. Supabase 프로젝트의 백업 보존 주기 확인
