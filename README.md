# 문철빵 · 애정 지방법원

연인에게 서운했던 일을 AI와 이야기하면 **장난스럽고 귀여운 고소장**으로 정리해 **링크 하나**로
전달하고, 상대가 같은 링크에서 **사과하거나 맞고소**한 뒤 두 사람의 마음을 나란히 보게 하는
감정 전달 서비스다. 로그인이 없고, 결과물은 7일 뒤 파기된다.

- 중재자 캐릭터: **밤톨**. 누가 옳은지 가리지 않고 두 사람의 대화를 돕는다.
- 실제 법률 서비스가 아니다. 판결·유무죄를 만들지 않는다.
- 기획 원문: [`docs/PRD.md`](docs/PRD.md) · 말투 규칙: [`docs/Tone_and_Voice.md`](docs/Tone_and_Voice.md)

---

## 동작 흐름

```
A(신청인)                                  B(상대방)
────────────────────────────────────────────────────────────
홈에서 "시작하기"
  └ 사건 생성 → /case/<public_token> 으로 이동
      (작성 권한 writer_token은 A 브라우저에만 보관)

밤톨과 대화 (채팅)
  └ 사건 / 감정과 이유 / 바라는 점이 모이면 초안 준비 완료
  └ 감정 채점 1회 → 대표 감정·왜곡 이미지 결정
      (동률이면 "둘 중 어느 쪽?" 한 번 질문)

고소장 검토
  └ 죄명·한 줄 요약·도입문을 AI가 생성 → 직접 수정 가능
  └ "고소장 접수하기"  ─────────────────▶  같은 링크를 열면
                                            소환장 도착 화면
"소환장, 준비됐어요"                          (도입문 → 고소장 펼치기)
  └ 링크 복사·공유                          
  └ 상대 답변 대기                           "내가 미안"  또는  "나도 할 말 있음"
                                                │                    │
                                           사과문 작성          밤톨과 대화 →
                                                │              맞고소장 검토
                                                └────── 제출 ───────┘
                                                (제출 시점에 선택 확정)
        ▼                                            ▼
   화해 성립                                   양측 진술 대질
   (사과문 + 종결 안내)                    (A·B 카드 + 중재자의 정리)
        └───────── 두 사람이 같은 링크에서 함께 본다 ─────────┘
                      7일 뒤 자동 파기
```

**핵심 규칙**

- 링크를 가진 사람이 B다. B에게는 토큰을 주지 않는다.
- 사과/맞고소 선택은 **제출할 때** 확정된다. 그전에는 되돌아가 바꿀 수 있고, 확정 뒤에는 바꿀 수 없다.
- 대화 원문은 저장하지 않는다. 확정된 카드·리포트·사과문만 DB에 남는다.
- 중복 제출은 DB 제약과 상태 조건부 UPDATE가 막고, 진 쪽은 최신 결과 화면으로 이동한다.

체험용 경로 `/wireframe`은 실제 사건 화면에 **가짜 사건 서버**(`mocks/demoCaseApi.ts`)를 주입해
렌더한다. 화면 문구와 구성이 실제와 같고, 저장·링크 발급만 일어나지 않는다. 하단 개발용 패널에서
화면을 직접 고를 수 있다.

---

## 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 프론트엔드 | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, framer-motion |
| 백엔드 | FastAPI, Pydantic v2, psycopg 3, OpenCV·NumPy(이미지 왜곡) |
| DB | Supabase(PostgreSQL). 브라우저는 DB에 직접 붙지 않는다 |
| AI | OpenAI `gpt-4.1-mini`, `store=False`. 키가 없으면 규칙 기반 로컬 모드 |
| 배포 | GitHub Actions → GHCR → Tailscale 경유 SSH → `docker compose` |

결정 배경은 [`docs/Tech_ADR.md`](docs/Tech_ADR.md)에 있다.

---

## 로컬 실행

### 1. 백엔드

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/api/docs
- `backend/.env`에 `OPENAI_API_KEY`, `DATABASE_URL`을 둔다. 키가 없으면 로컬 규칙 모드로 동작한다.
- 자세한 내용은 [`backend/README.md`](backend/README.md).

### 2. 프론트엔드

```bash
cd frontend
npm ci
npm run dev
```

http://localhost:3000 에서 시작한다. 개발 서버가 `/api/*`를 `127.0.0.1:8000`으로 넘기므로
브라우저에 키가 필요 없다.

### 3. 링크 흐름까지 확인하려면 DB가 필요하다

```bash
supabase start                 # Docker 필요. 마이그레이션이 자동 적용된다
cd backend && DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  uv run uvicorn app.main:app --port 8000
```

A와 B를 한 브라우저에서 나눠 보려면 A는 `localhost:3000`, B는 `127.0.0.1:3000`으로 연다
(출처가 달라 작성 권한 저장소가 분리된다). 이때 `next.config.ts`에
`allowedDevOrigins: ["127.0.0.1"]`를 임시로 넣어야 한다 — 커밋하지 않는다.

### 검사

```bash
cd backend  && uv run ruff check . && uv run python -m unittest discover -s tests -t tests -p 'test_*.py'
cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm test
```

CI(`.github/workflows/ci.yml`)가 PR마다 같은 검사를 돌린다.

---

## 파일 구조

```
.
├── backend/                    FastAPI 서버
│   ├── app/
│   │   ├── api/                라우트 — cases, conversation, card_summary, emotion_warp, mediation, health
│   │   ├── services/           대화 엔진, 중재 리포트, 카드 요약, 감정 채점·이미지 왜곡, OpenAI 호출
│   │   ├── schemas/            요청·응답 모델 (카드 형태의 권위는 schemas/complaint.py)
│   │   ├── repositories/       사건 SQL — 여기에만 둔다
│   │   ├── core/               설정, 토큰 발급·해시
│   │   ├── assets/emotions/    감정 이미지 8종 + 폴백
│   │   └── db.py               지연 생성 커넥션 풀
│   └── tests/                  unittest 회귀 테스트
│
├── frontend/                   Next.js 앱
│   ├── src/app/                라우트 — `/`, `/case/[token]`, `/wireframe`
│   ├── src/components/         공통 UI(Button·Heading·Notice·Toast), AppShell
│   ├── src/features/
│   │   ├── case/               링크 화면·단계 판정·A/B 흐름·작성 권한 (screens/에 상태별 화면)
│   │   │                        실제/체험이 같은 화면을 쓰고 서버만 갈아끼운다
│   │   ├── conversation/       채팅 화면과 대화 상태
│   │   └── report/             고소장 카드, 검토·사과 화면, 중재 리포트, 감정 이미지
│   ├── src/lib/api/            서버 어댑터 — cases, conversation, mediation, cardSummary, emotionWarp
│   └── tests/                  node --test 회귀 테스트
│
├── supabase/migrations/        DB 스키마 변경 이력 (적용은 수동 `supabase db push`)
├── docs/                       기획·설계 문서 (아래)
├── docker-compose.yml          운영 구성 (nginx-proxy 뒤에서 동작)
└── .github/workflows/          ci.yml, deploy.yml
```

---

## 문서

### 제품

| 문서 | 내용 |
| --- | --- |
| [PRD](docs/PRD.md) | 서비스 정의, 화면별 요구사항, 데이터 구조, 안전 원칙, 남은 미정 사항 |
| [Tone_and_Voice](docs/Tone_and_Voice.md) | 밤톨 말투 규칙, 용어집, 화면별 대표 문구 |
| [Design_System](docs/Design_System.md) | 색·타이포·간격·컴포넌트 규칙 (실제 CSS와의 차이 표기 포함) |
| [Wireframe_Coverage](docs/Wireframe_Coverage.md) | PRD 화면이 어디까지 구현됐는지 점검표 |

### 설계

| 문서 | 내용 |
| --- | --- |
| [API_Design](docs/API_Design.md) | 엔드포인트 계약, 상태 전이, 오류 규약, 원문 비저장 보장 |
| [Data_Flow](docs/Data_Flow.md) | 데이터 흐름(DFD), 저장 대상, 7일 만료·삭제 |
| [Supabase_Schema_Design](docs/Supabase_Schema_Design.md) | 테이블·제약·인덱스, 마이그레이션 목록과 적용 이력 |
| [Tech_ADR](docs/Tech_ADR.md) | 기술 선택 근거와 대안 비교, CI/CD 구성 |
| [Frontend_Architecture](docs/Frontend_Architecture.md) | 화면 책임 분리, 폴더 구조, 접근성·로딩 규칙 |

### 기능별 연동 기록

| 문서 | 내용 |
| --- | --- |
| [Case_Link_Integration](docs/Case_Link_Integration.md) | 사건 링크 생성·조회·저장 연결, 작성 권한 보관, 검증 결과 |
| [A_Conversation_Integration](docs/A_Conversation_Integration.md) | A 고소장 대화 엔진 |
| [B_Respondent_Integration](docs/B_Respondent_Integration.md) | B 열람·사과·맞고소와 양측 중재 |
| [Story_Intro_Design](docs/Story_Intro_Design.md) | 받은 고소장 도입문 생성 규칙 |
| [Emotion_Image_Warp_PRD](docs/Emotion_Image_Warp_PRD.md) | 감정 채점과 이미지 왜곡 사양 (구현 기준) |
| [Emotion_Image_Warp_Implementation_Plan](docs/Emotion_Image_Warp_Implementation_Plan.md) | 위 기능의 구현 계획 |
| [AI_Latency_Report](docs/AI_Latency_Report.md) | AI 응답 시간 측정과 동기 방식 유지 판단 |

작업 기록은 [`docs/progress/`](docs/progress), 설계·구현 계획서는
[`docs/superpowers/`](docs/superpowers)에 날짜별로 있다.

---

## 알려진 제약

- **작성자는 시작한 브라우저에서 접수를 마쳐야 한다.** 다른 기기에서 열면 상대방으로 보인다.
- **작성 중 새로고침하면 대화와 초안이 사라진다.** 원문을 저장하지 않는 설계 때문이다.
- 위험·학대성 내용 감지는 아직 연결되지 않았다. 안내 문구만 준비돼 있다.
- 사건 토큰이 서버 접근 로그에 남는다. 로그 마스킹은 배포 측 후속 작업이다.
- 운영 DB와 개발 DB가 분리돼 있지 않다.

그 밖에 남은 작업은 각 문서의 "남은 것 / 미결 사항" 절과 [`docs/progress/`](docs/progress)의
최신 기록을 참고한다.
