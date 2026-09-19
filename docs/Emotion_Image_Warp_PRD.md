# 감정 대표 이미지 선택 및 얼굴 왜곡(Warp) PRD

> 문서 버전: 1.2  
> 작성일: 2026-09-19 (최종 수정: 2026-09-19, 구현 대조 반영)  
> 상태: v1 구현 완료 — 이 문서는 `backend/app/schemas/emotion_warp.py`와 `services/emotion_*.py`를 기준으로 맞춤  
> 대상: 신청인(A) 고소장, 상대방(B) 맞고소장, 사과/맞고소 최종 결과 화면  
> 프로토타입: `sseung63-eng/img-wrap-test` commit `06a7267`

## 1. 배경

현재 서비스는 대화에서 추출한 감정을 `statement_cards.emotions text[]`에 라벨로만
저장한다. 고소장과 최종 결과는 텍스트 중심이라 사용자가 느낀 감정의 방향과 크기를
시각적으로 전달하지 못한다.

이 기능은 대화가 끝나 문서를 만드는 시점에 다음 작업을 수행한다.

```text
사용자 발화 전체
  → 13개 감정 라벨별 빈도·강도 스냅샷 생성
  → 대표 감정 이미지 1장 선택
  → 13개 점수를 6개 Warp 축으로 변환
  → 선택 이미지에 피쉬아이 Warp 적용
  → 고소장 및 최종 결과 화면에 표시
```

대화 중에는 이미지를 실시간으로 갱신하지 않는다. 사용자가 이전 진술을 수정했다면
수정 지점 이후의 폐기된 턴은 계산에서 제외하고, 화면에 남은 최종 사용자 발화만 사용한다.

## 2. 목표

- 동일한 대화 스냅샷에서 대표 이미지와 Warp 강도가 항상 동일하게 계산된다.
- 이미지 선택과 Warp가 같은 `raw_scores`를 사용한다.
- 대화 원문은 기존 정책대로 DB에 저장하지 않는다.
- 생성 당시 점수·매핑·파라미터를 저장해 나중에 다시 열어도 같은 결과를 재현한다.
- 신청인과 상대방의 감정은 각각 자기 발화만으로 계산한다.
- 이미지 생성 실패가 고소장 접수나 결과 열람을 막지 않는다.

## 3. 범위 밖

- 대화 도중 실시간 이미지 애니메이션
- 사용자가 직접 사진을 업로드하는 기능
- 얼굴 인식 또는 얼굴 부위별 랜드마크 추적
- LLM이 직접 0~1 점수를 생성하는 방식
- 채택되지 않은 꼭짓점 스트레치 방식
- 감정 이미지나 생성 PNG의 영구 원문 대체 저장

## 4. 현재 구현과 제약

### 4.1 서비스 저장 구조

- `statement_cards.emotions`는 단일 문자열이 아니라 PostgreSQL `text[]`다.
- 프론트와 백엔드도 `string[]` / `list[str]`로 사용한다.
- 이 배열은 중재 리포트와 화면 표시에도 쓰이므로 `"화남:0.8"`처럼 점수를 섞지 않는다.
- 대화 원문은 `useConversation()`의 `turns`에만 있고 새로고침하면 사라진다.
- 각 메시지 API는 현재 메시지와 구조화 상태만 받으므로 서버는 전체 대화를 갖고 있지 않다.

### 4.2 이미지 자산

| 파일 | 대표 감정 | 흡수하는 기존 라벨 |
| --- | --- | --- |
| `anger.png` | 분노 | 화남, 빡침 |
| `irritated.png` | 짜증 | 짜증 |
| `wronged.png` | 억울함 | 억울함, 무시당한 느낌 |
| `hurt.png` | 서운함/상처 | 서운함, 섭섭함, 상처받음 |
| `frustration.png` | 답답함 | 답답함 |
| `sadness.png` | 속상함 | 속상함 |
| `anxiety.png` | 불안 | 불안, 걱정 |
| `loneliness.png` | 외로움 | 외로움 |
| `asset1.png` | 폴백 | 인식된 감정 라벨이 없을 때 |

감정 이미지 8장은 420×420 PNG다. `asset1.png`은 폴백 전용이며 Warp를 적용하지 않는다.

### 4.3 Warp 프로토타입

`img-wrap-test/warp_hexagon.py`의 실제 축과 각도는 다음과 같다.

| 축 | 각도 | 위치 |
| --- | ---: | --- |
| 화남 | -120° | 좌상단 |
| 질투 | -60° | 우상단 |
| 슬픔 | 0° | 우측 |
| 포기 | 60° | 우하단 |
| 황당 | 120° | 좌하단 |
| 서운함 | 180° | 좌측 |

프로토타입은 OpenCV `remap`을 이용한 중심 기준 피쉬아이 왜곡이며 BGRA 이미지도 처리한다.
서비스에는 `warp_hexagon.py`만 이식하고 `original/`의 Streamlit·스트레치 코드는 넣지 않는다.

## 5. 사용자 흐름

### 5.1 A 고소장

1. A가 대화를 완료한다.
2. `고소장 초안 확인하기`를 누르면 최종 사용자 발화를 한 번 점수화한다.
3. 대표 이미지가 한 개로 결정되면 감정 프로파일을 생성한다.
4. 빈도와 강도가 모두 같은 후보가 둘 이상이면 초안으로 넘어가기 전에 꼬리질문을 보여준다.
5. 사용자가 가장 큰 감정을 선택하면 프로파일을 확정한다.
6. 검토 화면에서 Warp 이미지와 고소장 초안을 함께 확인한다.
7. 접수 시 카드와 감정 프로파일을 한 트랜잭션으로 저장한다.

### 5.2 B 맞고소장

A와 동일하되 점수 계산에는 B가 입력한 사용자 발화만 사용한다. A의 고소장,
A의 감정 프로파일, 중재자의 문장은 B 점수에 포함하지 않는다.

### 5.3 받은 고소장과 최종 결과

- 받은 고소장: A의 저장된 프로파일로 생성한 이미지를 도입문 위에 표시한다.
- 사과 결과: A 이미지와 사과문을 함께 표시한다.
- 맞고소 결과: A/B 이미지를 각자의 카드에 표시한다.
- 최종 중재 리포트: A/B 프로파일을 중재 AI 입력에는 넣지 않고 표시 용도로만 사용한다.

## 6. 감정 스코어링

### 6.1 입력

- 현재 화면에 남아 있는 사용자 발화 배열
- 최종 구조화 상태의 `emotions` 배열
- A/B 구분
- 동률 해소 시 사용자가 고른 대표 감정(선택)

중재자 응답, 상대방 카드, 폐기된 편집 이후 턴은 입력에 포함하지 않는다.

### 6.2 대상 라벨

고정된 13개 라벨만 점수화한다.

```text
걱정, 불안, 서운함, 섭섭함, 화남, 짜증, 빡침,
속상함, 외로움, 상처받음, 무시당한 느낌, 답답함, 억울함
```

LLM이 이 목록 밖의 감정을 반환하면 텍스트 카드에는 그대로 보존하지만 이미지 점수에는
사용하지 않는다. 13개 라벨이 하나도 없으면 폴백으로 처리한다.

### 6.3 AI 빈도·강도 채점

문서 생성 직전에 최종 사용자 발화만 AI에 전달한다. AI는 13개 고정 라벨별로 다음 값을
구조화 JSON으로 반환한다.

- `mention_count`: 감정이 직접 또는 문맥상 드러난 사용자 발화 수
- `score`: 빈도·표현 강도·문맥을 종합한 0~100 정수

같은 문장 안의 반복은 한 번으로 세며, 중재자의 질문은 근거로 사용하지 않는다. 서버는
허용 라벨, 범위, 중복을 다시 검증한다. OpenAI 미설정·실패 시 최종 `emotions`의 각 라벨을
1회·60점으로 변환해 문서 생성을 막지 않는다.

### 6.4 라벨 점수

Warp에는 AI 점수를 `score / 100`으로 정규화해 사용한다. 점수 공식은 애플리케이션에
중복 구현하지 않으며 AI의 구조화 응답을 단일 입력으로 사용한다.

### 6.5 대표 이미지 선택

1. 비교 단위는 이미지 그룹이 아니라 **라벨**이다(`services/emotion_profile.py`).
2. `mention_count`가 가장 큰 라벨을 우선한다.
3. 동률이면 그 중 `score`가 큰 라벨을 우선한다.
4. 두 값이 모두 같은 라벨이 둘 이상이면 `needs_clarification`을 반환한다. 후보가 같은
   이미지를 쓰더라도 지금은 질문한다 — 그룹 합산은 도입하지 않았다(§18).
5. 사용자는 후보 중 지금 가장 큰 감정 하나를 고른다.
6. 선택 결과는 시각 표현만 확정하며 기존 `emotions` 배열을 변경하지 않는다.

질문 예시:

```text
지금 마음에서 더 크게 남은 건 ‘서운함’과 ‘화남’ 중 어느 쪽에 가까워요?
```

## 7. 13개 라벨을 6개 Warp 축으로 변환

초기 매핑은 아래와 같다. 중복 매핑은 의도한 것으로 한 라벨이 두 방향에 기여할 수 있다.

| Warp 축 | 입력 라벨 |
| --- | --- |
| 화남 | 화남, 빡침, 짜증, 불안 |
| 질투 | 억울함, 무시당한 느낌, 불안 |
| 슬픔 | 속상함, 상처받음, 외로움, 걱정 |
| 포기 | 외로움, 빡침 |
| 황당 | 답답함 |
| 서운함 | 서운함, 섭섭함, 걱정 |

각 축의 기본 점수는 소속 라벨 점수 합을 0~1로 제한한다.

```text
axis[i] = clip(sum(label_scores mapped to axis[i]), 0, 1)
```

### 7.1 이웃 번짐

번짐은 렌더러 한 곳에서만 적용한다. `warp_hexagon._local_strength()`가 `neighbor_bleed`
(기본 0.15)로 이전·다음 축을 섞으며, 애플리케이션은 축 합산만 하고 번짐을 계산하지 않는다.

### 7.2 바닥값

```text
axis[i] = round(clip(sum(label_score/100 mapped to axis[i]), BASE, 1), 4)
BASE = 0.05
```

`BASE`는 여섯 방향에 최소 볼록 왜곡을 유지한다. 폴백 이미지(`asset1.png`)에는 Warp 자체를
적용하지 않는다.

렌더러 기본값은 `max_k = 2.5`, `neighbor_bleed = 0.15`, `radial_sharpness = 2.0`이며
스냅샷의 `params`에 함께 저장된다. `GLOBAL_WEIGHT`·`SCORE_EXPONENT`와 `(1 - BASE)` 스케일링은
v1에 도입하지 않았다(§18).

## 8. 스냅샷 데이터

`statement_cards`에 다음 컬럼을 추가한다.

```sql
alter table statement_cards
  add column emotion_scores jsonb not null default '{}'::jsonb;
```

`emotion_scores`는 단순 점수 맵이 아니라 재현에 필요한 단일 버전 스냅샷이다.

```json
{
  "version": "ai-warp-v1",
  "representative_emotion": "화남",
  "image": "anger.png",
  "scores": [
    {"label": "화남", "mention_count": 2, "score": 47},
    {"label": "짜증", "mention_count": 1, "score": 9}
  ],
  "axes": {
    "화남": 0.56,
    "질투": 0.05,
    "슬픔": 0.05,
    "포기": 0.05,
    "황당": 0.05,
    "서운함": 0.05
  },
  "resolved_by": "ai",
  "params": {
    "max_k": 2.5,
    "neighbor_bleed": 0.15,
    "radial_sharpness": 2.0,
    "base": 0.05
  }
}
```

형태의 권위는 `backend/app/schemas/emotion_warp.py`의 `EmotionProfile`이다. `asset_version`·
`warp_source_commit`·`emphasis_count`·`score_exponent`·`global_weight`는 v1에 없다(§18).


규칙:

- 근거가 없는 라벨(`mention_count`·`score`가 0)은 저장하지 않는다. 점수는 0~100 정수다.
- 사용자가 동률 질문으로 정했다면 `resolved_by`는 `user`다.
- 폴백은 `image: "asset1.png"`, `resolved_by: "fallback"`이며 `representative_emotion`은 `null`이다.
  `axes`는 폴백에서도 6축을 모두 채운다(최솟값 `base` 0.05). `asset1.png`은 렌더 단계에서 Warp를
  건너뛴다(`services/emotion_warp.py`).
- Pydantic 모델로 허용 키, 숫자 범위, 버전을 검증한다.
- `emotion_scores`는 표시용 파생 데이터이므로 `PRESENTATION_FIELDS`에 추가해 중재 AI,
  B 진술 수집 AI, 카드 요약 AI 입력에서 제외한다.

## 9. 재현성 정책

원시 점수만 저장해도 코드나 이미지가 바뀌면 결과 PNG는 달라질 수 있다. 따라서 다음을
함께 지킨다.

- 이미지 파일은 덮어쓰지 않고 변경 시 새 `asset_version`을 만든다.
- Warp 계산 변경 시 기존 `warp-v1`을 수정하지 않고 `warp-v2`를 추가한다.
- v1은 단일 렌더러다. 스냅샷의 `params`만 읽고, 알 수 없는 `version`은 스키마 단계에서 422로 거부한다.
  버전 분기와 `asset_version`은 `warp-v2` 도입 시점의 과제다.
- 조회 시 raw score를 다시 계산하지 않고 저장된 `axes`와 `params`만 읽는다.
- 문서 유효기간 7일 동안 해당 버전 렌더러와 자산을 유지한다.

생성 PNG 자체는 DB에 저장하지 않는다. 같은 스냅샷·자산·OpenCV 버전에서 결정적으로
재생성한다. OpenCV와 NumPy 버전은 `uv.lock`으로 고정한다.

## 10. API 설계

### 10.1 감정 프로파일 생성

```http
POST /api/complaint/emotion-profile
Content-Type: application/json
Cache-Control: no-store
```

요청:

```json
{
  "messages": ["진짜 너무 서운했어", "연락이 없어서 걱정했어"],
  "emotions": ["서운함", "걱정"]
}
```

확정 응답:

```json
{
  "profile": {"version": "ai-warp-v1"},
  "needs_clarification": false,
  "candidates": [],
  "mode": "openai"
}
```

동률 응답:

```json
{
  "profile": {"version": "ai-warp-v1"},
  "needs_clarification": true,
  "candidates": ["화남", "서운함"],
  "mode": "openai"
}
```

제약:

- 사용자 발화만 전송한다.
- 최대 20개 턴, 전체 80,000자로 제한한다.
- 서버는 원문을 저장하거나 로그에 남기지 않는다.
- 문서 생성 시 OpenAI 구조화 채점을 한 번 호출한다.
- 응답은 캐시하지 않는다.

### 10.2 동률 해소

```http
POST /api/complaint/emotion-profile/resolve
Content-Type: application/json
```

프로파일과 사용자가 고른 라벨을 받아 대표 감정·이미지를 확정한 프로파일을 돌려준다
(`resolved_by: "user"`). 후보 밖 라벨은 422다.

### 10.3 저장 전 미리보기 이미지

```http
POST /api/complaint/emotion-warp
Content-Type: application/json
```

검증된 profile을 받아 `image/png`를 반환한다. 검토 화면에서 사용한다.

### 10.4 저장된 사건 이미지

사건 조회 API가 만료 검사 후 카드의 `emotion_scores`를 프론트에 전달한다. 프론트는 저장 전과
같은 `POST /api/complaint/emotion-warp`에 이 스냅샷을 보내 PNG를 재생성한다. 별도 이미지
조회 API와 이미지 파일 저장소는 두지 않는다.

## 11. 백엔드 구현 위치

| 파일 | 작업 |
| --- | --- |
| `backend/app/services/emotion_profile.py` | 13개 라벨 탐색, 빈도·강도, 대표 이미지, 6축 계산 |
| `backend/app/services/warp_hexagon.py` | 프로토타입 commit `06a7267`의 서비스용 함수 이식 |
| `backend/app/services/emotion_warp.py` | 자산 로딩, Warp 호출, PNG 인코딩 (버전 분기 없음) |
| `backend/app/schemas/emotion_warp.py` | 요청·프로파일·동률 응답 검증 모델 |
| `backend/app/api/emotion_warp.py` | 프로파일 POST, 동률 해소 POST, 이미지 POST |
| `backend/app/api/cases.py` | 사건 조회 응답에 `emotion_scores` 포함 (이미지 GET 없음) |
| `backend/app/schemas/complaint.py` | `SharedStatement.emotion_scores` 추가 및 AI 입력 제외 |
| `backend/app/repositories/cases.py` | JSONB 조회·저장 |
| `backend/app/main.py` | 라우터 등록 |
| `backend/pyproject.toml` | `numpy`, `opencv-python-headless` 추가 |
| `backend/app/assets/emotions/` | 이미지 8장과 폴백 자산의 버전 고정 복사본 |
| `supabase/migrations/*_add_emotion_scores.sql` | JSONB 컬럼과 object 타입 CHECK 추가 |

백엔드 Docker build context가 `./backend`이므로 `frontend/public/images`를 런타임에 직접
읽을 수 없다. 백엔드 자산 폴더에 버전 고정 복사본을 둔다. 지금은 수동 동기화이며, 프론트 원본과의
체크섬 비교 테스트는 아직 없다(과제).

프로토타입 저장소에는 명시적인 라이선스 파일이 없으므로 서비스 코드로 이식하기 전에
저장소 소유자 또는 팀 내부 사용 권한을 확인하고 원본 commit을 문서에 남긴다.

## 12. 프론트엔드 구현 위치

| 파일 | 작업 |
| --- | --- |
| `frontend/src/lib/api/emotionWarp.ts` | 프로파일 생성, 동률 재요청, PNG Blob 요청 |
| `frontend/src/features/conversation/useConversation.ts` | 최종 사용자 발화 배열 제공 |
| `frontend/src/features/conversation/LiveConversationScreen.tsx` | 초안 전 프로파일 생성 및 동률 질문 |
| `frontend/src/features/report/types.ts` | `emotion_scores` 타입 추가 |
| `frontend/src/features/report/EmotionWarpImage.tsx` | Blob URL 수명·로딩·폴백 처리 |
| `frontend/src/features/report/PreviewScreen.tsx` | 저장 전 미리보기 (`StatementCard` 경유) |
| `frontend/src/features/report/StatementSummary.tsx` | 펼친 고소장 카드 안에서만 표시 (도입문 위 표시는 미구현) |
| `frontend/src/features/report/StatementCard.tsx` | 카드 이미지 표시 (표시 여부 옵션은 없음) |
| `frontend/src/features/case/screens/CounterclaimResult.tsx` | A/B 카드를 통해 나란히 표시 |
| `frontend/src/features/case/screens/ApologyResult.tsx` | A 이미지와 사과 결과 표시 |
| `frontend/src/app/globals.css` | 420×420 비율, 모바일 크기, 로딩 영역 |

표시 여부 옵션은 아직 없고 `StatementCard`가 항상 이미지를 그린다. 중복은 호출 측에서
카드와 이미지를 겹쳐 쓰지 않는 방식으로 피한다(`ApologyResult`는 이미지를 직접 렌더).
Blob URL은 교체·언마운트 시 반드시 `URL.revokeObjectURL()`로 해제한다.

## 13. 실패 처리

- 프로파일 생성 실패: `asset1.png` 폴백으로 초안 작성을 계속한다.
- 동률 질문 API 실패: 재시도를 안내한다. 선택을 마쳐야 초안으로 넘어갈 수 있으며 임시 선택
  폴백은 아직 없다(과제).
- Warp 생성 실패: 선택된 원본 감정 이미지를 그대로 표시한다.
- 저장된 사건 이미지 실패: 이미지 영역만 폴백하며 문서 내용은 계속 보여준다.
- 알 수 없는 버전: 스키마 검증에서 422로 거부한다(폴백 반환 아님).
- 이미지 오류에 대화 원문이나 토큰을 로그로 남기지 않는다.

## 14. 성능 및 운영

- 감정 이미지 8장과 그 출력은 420×420 PNG다. 폴백 `asset1.png`는 373×458이라 화면에서
  `object-fit: contain`으로 맞춘다.
- 프로파일 계산 목표: 로컬 p95 50ms 이하.
- Warp 생성 목표: 백엔드 단일 요청 p95 500ms 이하를 초기 기준으로 측정한다.
- 한 사건 화면에서 같은 side 이미지를 중복 요청하지 않는다.
- 프로세스 내 디코딩 자산 캐시는 허용하지만 사용자별 생성 결과는 영구 캐시하지 않는다.
- 관측 항목: 성공/폴백/동률 발생/렌더 실패 횟수와 처리 시간. 원문과 감정 이유는 기록하지 않는다.

## 15. 테스트 계획

### 15.1 스코어링 단위 테스트

- 13개 라벨과 동의어가 정확한 count로 합쳐진다.
- 한 표현을 여러 패턴으로 중복 계산하지 않는다.
- 강조어가 같은 문장 안에서만 가산된다.
- 수정 후 제거된 턴이 요청에 포함되지 않는다.
- 그룹 빈도 → 그룹 점수 → 사용자 질문 순서로 대표 감정을 결정한다.
- A/B 발화와 상대 카드가 섞이지 않는다.
- 모든 점수와 축 값은 0~1 범위다.
- 폴백은 Warp를 적용하지 않는다.

### 15.2 Warp 단위 테스트

현재 커버된 것은 `tests/test_emotion_profile.py`의 "PNG가 반환된다" 하나뿐이고,
아래 항목은 미작성 과제다.

- 420×420 BGRA 입력의 크기와 알파 채널이 유지된다.
- 동일 입력과 스냅샷은 동일한 출력 크기·허용 오차 내 픽셀 결과를 낸다.
- BASE 때문에 여섯 축 최종값이 최소 0.05 이상이다.
- 이웃 번짐이 한 번만 적용된다.
- 잘못된 키, NaN, 범위 밖 값은 422 또는 안전한 폴백으로 처리된다.

### 15.3 API·DB 테스트

- `emotion_scores`가 A/B 카드와 함께 원자적으로 저장된다.
- 저장·조회 round-trip에서 JSON 값이 변하지 않는다.
- 기존 카드의 빈 profile이 폴백으로 동작한다.
- 만료·404·잘못된 side가 기존 사건 API 정책을 따른다.
- 응답에 원문이 포함되거나 에러로 누출되지 않는다.

### 15.4 프론트 테스트

- 초안 확인 시 프로파일을 한 번만 생성한다.
- 동률 질문 응답 후에만 초안으로 이동한다.
- 편집 후 프로파일은 새 최종 턴으로 다시 한 번 생성된다.
- Preview, 받은 고소장, 사과 결과, 맞고소 결과에 올바른 side 이미지가 표시된다.
- 로딩·실패·폴백이 고소장 제출 버튼을 영구 차단하지 않는다.

## 16. 수용 기준

1. 대화 완료 전에는 감정 이미지 API를 호출하지 않는다.
2. 문서 생성 시 사용자 발화 전체를 기준으로 13개 라벨 스냅샷을 한 번 생성한다.
3. 대표 이미지와 6축 Warp가 동일한 스냅샷을 사용한다.
4. 빈도·강도가 모두 동률인 경우 사용자에게 후보 감정을 질문한다.
5. 결과 프로파일은 `statement_cards.emotion_scores` JSONB에 저장된다.
6. 고소장 재조회 시 raw score를 다시 계산하지 않는다.
7. Warp 이미지가 고소장, 사과 결과, 맞고소 최종 결과에 표시된다.
8. A와 B의 점수·이미지는 서로의 발화에 영향을 받지 않는다.
9. 대화 원문은 DB·애플리케이션 로그에 저장되지 않는다.
10. 이미지 처리 실패 시 문서 생성·접수·열람은 계속 가능하다.
11. 백엔드 전체 테스트, 프론트 테스트, 린트, 프로덕션 빌드, Docker 이미지 빌드가 통과한다.

## 17. 구현 순서

1. `emotion_scores` 스키마와 DB 마이그레이션
2. 13개 라벨 스코어러 및 대표 이미지 동률 처리
3. `warp_hexagon.py` 이식, 자산 배치, OpenCV 의존성 추가
4. 프로파일·미리보기·저장 사건 이미지 API
5. 대화 완료와 프로파일 생성/동률 질문 연결
6. 고소장 검토·수신 화면 연결
7. 사과/맞고소 최종 결과 연결
8. 파라미터 시각 튜닝과 성능 측정
9. 문서·API·데이터 흐름 갱신

## 18. 구현 전 확정할 항목

- 6축 이름은 프로토타입의 `화남/질투/슬픔/포기/황당/서운함`을 v1에서 유지한다.
  특히 질투·포기 축은 입력 라벨과 의미 차이가 있으므로 제품 문구에는 노출하지 않는다.
- 13개 라벨→6축 중복 매핑표는 초기 제안이며 실제 이미지 튜닝 결과로 확정한다.
- v1 기준값은 `BASE=0.05`, `neighbor_bleed=0.15`, `max_k=2.5`, `radial_sharpness=2.0`이다.
  `SCORE_EXPONENT`·`GLOBAL_WEIGHT`는 도입하지 않았다.
- 대표 이미지 선택은 라벨 단위 비교다. 이미지 그룹 합산은 도입하지 않았다(§6.5).
- `asset1.png`을 감정 없음/미인식 폴백으로 쓰되 Warp하지 않는다.
- 프로토타입 코드의 서비스 사용 권한을 확인한다.
