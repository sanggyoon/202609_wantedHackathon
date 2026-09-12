-- 만료·삭제: 만료된 사건의 결과물을 물리 삭제하는 함수와 pg_cron 스케줄.
-- 설계 근거: docs/Supabase_Schema_Design.md §6, docs/Data_Flow.md §7.3
--
-- 이 파일을 case_schema와 분리한 이유:
-- Supabase에서 pg_cron 활성화는 설치 스키마 제약 때문에 마이그레이션에서
-- 실패할 여지가 있다. 파일이 분리돼 있으면 이 파일이 깨져도 핵심 스키마는
-- 적용된 상태로 남는다. 실패 시 대시보드 Database > Extensions에서 pg_cron을
-- 수동으로 켠 뒤 이 마이그레이션만 재시도하면 된다.
--
-- 만료는 "화면을 가리는 일"이 아니라 "데이터를 소멸시키는 일"이다.
-- 다만 이 배치는 최대 1시간 지연되므로, 그 틈은 FastAPI가 조회 시점에
-- expires_at을 확인하는 lazy 검사로 막아야 한다. 둘 중 하나만으로는
-- 부족하다 — lazy만으로는 데이터가 남고, 배치만으로는 최대 1시간 동안
-- 만료된 내용이 노출된다.


-- ---------------------------------------------------------------------------
-- 1. 확장
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;


-- ---------------------------------------------------------------------------
-- 2. 삭제 함수
-- ---------------------------------------------------------------------------
--
-- 결과물(D2·D3·D4)은 물리 삭제하고, cases 행은 남겨 EXPIRED로 전이시킨다.
-- 행을 남기는 이유는 두 가지다.
--   - 같은 토큰이 재발급되는 것을 막는다.
--   - purged_at으로 삭제가 실제로 완료됐음을 검수에서 증명할 수 있다.
-- 남는 것은 메타데이터뿐이며 사건 내용은 포함되지 않는다.
--
-- security definer로 두는 이유: cron 잡 실행 주체와 무관하게 동일한 권한으로
-- 동작해야 하기 때문. search_path를 고정해 탐색 경로 하이재킹을 막는다.

create or replace function purge_expired_cases()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id)
    into v_ids
    from cases
   where expires_at <= now()
     and status <> 'EXPIRED';

  if v_ids is null then
    return 0;
  end if;

  delete from statement_cards   where case_id = any (v_ids);
  delete from apologies         where case_id = any (v_ids);
  delete from mediation_reports where case_id = any (v_ids);

  update cases
     set status    = 'EXPIRED',
         purged_at = now()
   where id = any (v_ids);

  return array_length(v_ids, 1);
end;
$$;

comment on function purge_expired_cases() is
  '만료된 사건의 결과물(카드·사과문·리포트)을 물리 삭제하고 cases를 EXPIRED로 전이한다. 처리한 사건 수를 반환.';

-- 함수 실행 권한은 기본적으로 PUBLIC에 부여되므로 회수한다.
-- cron 잡과 소유자만 실행할 수 있으면 된다.
revoke all on function purge_expired_cases() from public;
revoke all on function purge_expired_cases() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. 스케줄
-- ---------------------------------------------------------------------------
--
-- 매시 정각 실행. 같은 이름의 잡이 이미 있으면 먼저 제거해 재실행 시
-- 중복 등록되지 않게 한다 (Preview Branch 재생성 등).

select cron.unschedule('purge-expired-cases')
 where exists (
   select 1 from cron.job where jobname = 'purge-expired-cases'
 );

select cron.schedule(
  'purge-expired-cases',
  '0 * * * *',
  $job$select public.purge_expired_cases()$job$
);
