# 감정 이미지 선택·왜곡 기능 구현계획서

> 기준 브랜치: `dongnyeon`  
> 기준 커밋: `66186f0` (원격 `main`, PR #26 반영)  
> 작성일: 2026-09-19  
> 관련 기획: `docs/Emotion_Image_Warp_PRD.md`

## 1. 구현 목표

사용자의 최종 대화에서 AI가 13개 감정의 언급 횟수와 강도를 채점한다. 채점 결과로
8개 감정 이미지 중 한 장을 고르고, 6개 방향별 왜곡 강도를 계산해 고소장과 최종
보고서에 삽입한다.

- 대화 도중에는 이미지를 표시하지 않는다.
- A와 B는 각자 문서 생성 시 이미지 한 장을 만든다.
- 최종보고서는 A/B 문서에 확정된 이미지 설정을 그대로 재사용한다.
- 대화 원문은 앱 DB에 저장하지 않는다.
- AI 채점 결과와 왜곡 재현에 필요한 값만 `statement_cards`에 저장한다.

## 2. 현재 코드에서 확인된 전제

- 대화 원문은 `frontend/src/features/conversation/useConversation.ts`의 `turns`에만 있다.
- 진술 수정 시 수정 지점 이후 `turns`가 잘리므로, 완료 시 남은 사용자 발화가 최종본이다.
- 확정 카드는 `SharedStatement`로 A/B 공통 처리되고 `statement_cards`에 저장된다.
- `emotions text[]`는 카드 표시, 공유 선택, B 대화, 중재 리포트에 이미 사용된다.
- 따라서 `emotions`에는 계속 감정명만 저장하고 점수 데이터를 섞지 않는다.
- 백엔드 Docker 빌드 범위는 `backend/`이므로 왜곡용 이미지도 백엔드 안에 있어야 한다.
- 프론트 최신 이미지 8장은 420×420이며 폴백 `asset1.png`는 별도 비율이다.

## 3. 확정 데이터 흐름

```text
최종 사용자 발화 목록
  → POST /api/complaint/emotion-profile
  → AI: 13개 감정별 mention_count + score(0~100)
  → 서버: 대표 감정/이미지 및 6축 값 계산
  → 완전 동률이면 후보 감정 반환
  → 사용자가 후보 중 하나 선택
  → POST /api/complaint/emotion-profile/resolve
  → POST /api/complaint/emotion-warp 로 미리보기
  → 고소장 확정 시 emotion_scores JSONB 저장
  → 저장 문서 이미지는 저장된 스냅샷으로 재생성
```

## 4. AI 채점 계약

AI에는 사용자의 최종 발화만 전달한다. 중재자의 문장과 상대방 카드 내용은 감정 점수
근거로 사용하지 않는다.

허용 라벨은 다음 13개로 고정한다.

`화남`, `빡침`, `짜증`, `억울함`, `무시당한 느낌`, `서운함`, `섭섭함`,
`상처받음`, `답답함`, `속상함`, `불안`, `걱정`, `외로움`

AI 응답:

```json
{
  "emotions": [
    {"label": "화남", "mention_count": 3, "score": 90},
    {"label": "서운함", "mention_count": 2, "score": 65}
  ]
}
```

- `mention_count`: 감정이 직접 또는 문맥상 드러난 사용자 발화 수
- `score`: 빈도·표현 강도·문맥을 종합한 0~100 정수
- 근거가 없는 라벨은 `mention_count=0`, `score=0`
- 모델 응답은 서버가 라벨, 범위, 중복을 다시 검증하고 정규화한다.
- OpenAI 미설정 또는 호출 실패 시 기존 `emotions`를 각 1회·60점으로 변환한다.

## 5. 대표 이미지와 동률

1. `mention_count` 최댓값
2. 동률 후보 중 `score` 최댓값
3. 두 값도 같으면 `needs_clarification=true`와 후보 목록 반환
4. 사용자가 후보를 고르면 그 감정을 대표 감정으로 확정

대표 이미지 매핑:

| 이미지 | 감정 |
| --- | --- |
| `anger.png` | 화남, 빡침 |
| `irritated.png` | 짜증 |
| `wronged.png` | 억울함, 무시당한 느낌 |
| `hurt.png` | 서운함, 섭섭함, 상처받음 |
| `frustration.png` | 답답함 |
| `sadness.png` | 속상함 |
| `anxiety.png` | 불안, 걱정 |
| `loneliness.png` | 외로움 |
| `asset1.png` | 감정 없음 또는 처리 실패 |

## 6. 6축 왜곡 계산

AI 점수를 `score / 100`으로 정규화한 뒤 다음 축에 합산하고 1로 제한한다.

- 화남: 화남, 빡침, 짜증, 불안
- 질투: 억울함, 무시당한 느낌, 불안
- 슬픔: 속상함, 상처받음, 외로움, 걱정
- 포기: 외로움, 빡침
- 황당: 답답함
- 서운함: 서운함, 섭섭함, 걱정

모든 축에는 `BASE=0.05`를 적용한다. 스무딩은 `warp_hexagon.py`의
`neighbor_bleed=0.15` 한 곳에서만 적용해 중복 계산하지 않는다.

## 7. 저장 구조

새 마이그레이션으로 다음 컬럼을 추가한다.

```sql
alter table statement_cards
  add column emotion_scores jsonb not null default '{}'::jsonb;
```

저장값은 대화 원문이 아닌 버전 스냅샷이다.

```json
{
  "version": "ai-warp-v1",
  "representative_emotion": "화남",
  "image": "anger.png",
  "scores": [{"label": "화남", "mention_count": 3, "score": 90}],
  "axes": {"화남": 0.9, "질투": 0.05, "슬픔": 0.05, "포기": 0.05, "황당": 0.05, "서운함": 0.05},
  "resolved_by": "ai",
  "params": {"max_k": 2.5, "neighbor_bleed": 0.15, "radial_sharpness": 2.0, "base": 0.05}
}
```

`emotion_scores`는 표시용 파생 데이터이므로 카드 요약, B 대화, 중재 AI 입력에서 제외한다.

## 8. 백엔드 변경

1. `schemas/emotion_warp.py`: 요청·응답·스냅샷 모델
2. `services/emotion_profile.py`: AI 프롬프트, 검증, 대표 감정, 6축 계산
3. `services/warp_hexagon.py`: 프로토타입의 순수 왜곡 함수 이식
4. `services/emotion_warp.py`: 이미지 로드·왜곡·PNG 인코딩
5. `api/emotion_warp.py`: 채점, 동률 해소, 미리보기, 저장 카드 이미지 API
6. `schemas/complaint.py`: `SharedStatement.emotion_scores` 추가 및 AI 전달 제외
7. `repositories/cases.py`: JSONB 저장·조회
8. `pyproject.toml`: `numpy`, `opencv-python-headless` 추가
9. `app/assets/emotions/`: 문서 생성용 버전 고정 이미지
10. Supabase 마이그레이션 추가

## 9. 프론트엔드 변경

1. 대화 완료 콜백에 최종 사용자 발화 목록 포함
2. `lib/api/emotionWarp.ts` 어댑터 추가
3. 대화 완료 후 감정 채점 진행 상태 표시
4. 완전 동률이면 후보 감정 선택 UI 표시
5. 완성된 `emotion_scores`를 `Statement`에 포함
6. `EmotionWarpImage` 컴포넌트로 미리보기 PNG 요청·폴백 처리
7. `StatementCard`에 이미지 삽입
8. A/B 카드가 함께 보이는 최종보고서에서 각 카드의 저장된 설정 재사용
9. 개발 프록시에 감정 이미지 API 경로 추가

## 10. 실패 처리

- AI 실패: 기존 `emotions` 기반 로컬 프로필
- 감정 없음: `asset1.png`, 왜곡 없음
- 왜곡 실패: 선택된 원본 감정 이미지
- 이미지 API 실패: 프론트 정적 이미지 폴백
- 감정 처리 실패는 고소장 제출을 막지 않는다.

## 11. 테스트와 완료 조건

- AI 응답의 라벨·범위·중복 정규화
- 최다 빈도, 점수 동률, 완전 동률 선택
- 13개 감정 → 이미지 8종 및 6축 매핑
- 동일 스냅샷의 PNG 결과 재현
- A/B 스냅샷 분리 저장
- 대화 원문이 DB·로그에 저장되지 않음
- 만료 사건 이미지 API가 410 반환
- 백엔드 테스트·린트, 프론트 테스트·린트·빌드 통과

## 12. 구현 순서와 커밋 단위

1. `docs: 감정 이미지 왜곡 구현계획 확정`
2. `feat(backend): 감정 프로필 채점과 저장 스키마 추가`
3. `feat(backend): 육각형 이미지 왜곡 API 추가`
4. `feat(frontend): 문서 생성 시 감정 이미지 연결`
5. `test: 감정 이미지 생성 흐름 통합 검증`

