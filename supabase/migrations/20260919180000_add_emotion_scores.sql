alter table statement_cards
  add column emotion_scores jsonb not null default '{}'::jsonb;

alter table statement_cards
  add constraint statement_cards_emotion_scores_object
  check (jsonb_typeof(emotion_scores) = 'object');

comment on column statement_cards.emotion_scores is
  '문서 생성 시 확정한 감정 점수·대표 이미지·6축 왜곡값의 버전 스냅샷. 대화 원문은 포함하지 않는다.';
