-- 받은 고소장 화면에서 전체 문서를 열기 전에 보여줄 짧은 1인칭 도입문.
alter table statement_cards
  add column story_intro text not null default '';

comment on column statement_cards.story_intro is
  '공유 확정 카드만으로 생성하고 작성자가 검토한, 수신자용 귀여운 고소 도입문.';

