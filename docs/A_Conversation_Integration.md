# A 고소장 대화 엔진 연결

## 범위

`jhon829/reconcile-ai-private-flow-lab`의 `complaint_engine.py`, 고소장 모델과
회귀 테스트를 이식했다. 기존 실험용 세션·JSON 저장·공유 API는 가져오지 않았다.
이식 기준 커밋은 `9412610`이다.
현재 A 진술만 실제 백엔드와 연결된다. B 맞고소, 사과, 공유·리포트는 기존 흐름이다.

## 구조

- 화면: `features/conversation/LiveConversationScreen.tsx`
- 입력·수정·취소·진행 상태: `useConversation.ts`
- HTTP 연결: `lib/api/conversation.ts`
- 백엔드 라우트: `app/api/conversation.py`
- 데이터 모델: `app/schemas/complaint.py`
- 정보 추출·누락 항목·생성 가능 판단: `app/services/complaint_engine.py`
- 제공자 연결: `app/services/openai_gateway.py`

원본의 반말 프롬프트를 밤톨 존댓말로 조정했다. 현재 턴과 구조화 상태를 전달하며,
전체 대화 로그를 모델에 보내지는 않는다. API 키가 있으면 추출·응답 생성에 최대 두 번
호출한다. 키가 없으면 로컬 규칙 응답임을 표시한다. 연결 오류는 재시도 가능하게 보여준다.

생성 가능 판단은 PRD의 필수 데이터 3개를 따른다. 사건 내용(`incident`), 감정과 이유
(`emotion`, `emotion_reason`), 상대에게 바라는 점(`desired_outcome`)이 확인되면
고소장 초안으로 이동할 수 있다. `hurt_point`는 답변에 드러나면 추출하지만, 별도 필수
완료 조건으로 막지 않는다.

진술 수정 시 해당 턴 이전 상태로 돌아가 수정된 메시지를 다시 처리한다.
성공하면 이후 대화를 폐기하고 다시 이어간다. 실패 시 기존 대화와 입력을 유지한다.
미리보기로 이동하면 대화 컴포넌트가 해제되고 정리된 사건·감정·바라는 점만 전달된다.

## 실행

1. `backend`: `uv sync`, `uv run uvicorn app.main:app --reload --port 8000`
2. `frontend`: `npm ci`, `npm run dev`
3. `http://localhost:3000/wireframe` → 사건 접수 → 원고 진술

PowerShell에서 npm 실행 정책 오류가 있다면 `npm.cmd`를 사용한다.
키를 `.env`에 추가한 경우 백엔드를 재시작한다. `.env`는 커밋하지 않는다.

## 검증과 한계

- 원본 기반 테스트: 정보 부족, 한 번에 모두 입력, 추측 구분, 감정·이유 순서, 요청 창작 방지
- API 테스트: 상태 반환, no-store, 빈 입력, 검증 오류의 입력 미노출, 제공자 예외 미노출
- 실제 OpenAI 응답과 개발 프록시를 통과하는 생성 가능 응답 확인
- 실제 스트리밍, 위험 내용 감지 완성, 동시 요청 제한, 인증, 최종 결과 저장은 이번 범위가 아니다.
- 결과 모델에 기대·추측을 선택 필드로 추가했다. 공유 항목에서 해제한 내용은 초안으로 전달하지 않는다.
- 대화와 초안은 메모리에서만 유지한다. 최종 저장 모델 연결은 후속이다.
- `store=False`는 외부 제공자의 모든 보관을 금지한다는 뜻이 아니다.
