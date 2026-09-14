
# 디자인 시스템

> 원티드 AI Championship 2026

---

## 1. 컬러 시스템 (Color System)

### 브랜드 컬러

| 이름 | Hex | 용도 |
|------|-----|------|
| Primary | `#0E5748` | 주요 브랜드 컬러, CTA, 강조 |
| White | `#FFFFFF` | 역전 텍스트, 카드 배경 등 |

### 배경색 (Background)

기본 앱 배경은 단색이 아닌 그라디언트를 사용한다.

| 속성 | 값 |
|------|----|
| Type | Linear |
| Angle | -7° |
| Stop 1 | `#FAFAFA` — 26% |
| Stop 2 | `#F0EFEE` — 84% |

```css
background: linear-gradient(-7deg, #F0EFEE 0%, #FAFAFA 26%, #F0EFEE 84%);
/* 또는 단순하게 */
background: linear-gradient(-7deg, #FAFAFA 26%, #F0EFEE 84%);
```

### 시멘틱 컬러 (Semantic)

| 이름 | Hex | 용도 |
|------|-----|------|
| Semantic-Red | `#D6705C` | 에러, 경고, 삭제 강조 |
| Semantic-Bg | `#FEE6E1` | 에러 배경, 토스트 배경 |
| Semantic-Green | `#05E173` | 성공, 완료 상태 |

### 텍스트 컬러 계층

| 이름 | Hex | 용도 |
|------|-----|------|
| Text-Primary | `#28272A` | 제목, 주요 본문 (최강조 포함) |
| Text-Secondary | `#5A5A5E` | 부제목, 보조 정보 |
| Text-Tertiary | `#868688` | 캡션, 레이블 |
| Text-Disabled | `#ACACAF` | 비활성 텍스트 |
| Text-Placeholder | `#D8D8DA` | 플레이스홀더, 최소 강조 |

---

## 2. 타이포그래피 (Typography)

### 폰트 패밀리

**Pretendard** 단일 서체 사용

| 이름 | 굵기 코드 | 용도 |
|------|-----------|------|
| Regular | 400 | 본문 텍스트 |
| Medium | 500 | 보조 강조, 레이블 |
| Semibold | 600 | 소제목, 버튼 |
| Bold | 700 | 제목, 강조 헤딩 |

### 폰트 로드

**Pretendard** (기본 UI 서체)

```html
<!-- HTML <head>에 추가 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css" />
```

```css
/* CSS font-family 기본값 */
font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif;
```

**배민 꾸불림체** (포인트 서체)

- 공식 다운로드: [woowahan.com/fonts](https://www.woowahan.com/fonts)
- 라이선스: OFL — 개인·상업적 사용 무료
- 눈누 CDN: [noonnu.cc](https://noonnu.cc/font_page/10)

```css
@font-face {
  font-family: 'BMkkubulim';
  src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMkkubulim.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
```

```css
/* 포인트 서체 적용 시 */
font-family: 'BMkkubulim', sans-serif;
```

### 자간 (Letter-spacing)

| 서체 | 값 | 비고 |
|------|----|------|
| Pretendard | `0` | 기본값 유지 (letter-spacing 별도 지정 불필요) |
| BMkkubulim | `0.02em` | 2%, 포인트 서체 가독성 확보 |

### 타입 스케일

| 스타일 | 크기 | 용도 예시 |
|--------|------|-----------|
| H1 | 40px | 메인 헤딩 |
| H2 | 36px | 섹션 제목 |
| H3 | 24px | 서브 제목 |
| H4 | 20px | 카드 제목, 강조 본문 |
| H5 | 16px | 본문, 레이블 |
| H6 | 12px | 캡션, 메타 정보 |

---

## 3. 아이콘 (Iconography)

**Lucide Icons** 사용

- 공식 사이트: [lucide.dev](https://lucide.dev)
- NPM: `npm install lucide-react` (React) / `npm install lucide` (Vanilla JS)
- 기본 스트로크 두께: 2px
- 기준 사이즈: 16px / 20px / 24px

```bash
# React
npm install lucide-react

# Vue
npm install lucide-vue-next
```

---

## 4. 스페이싱 & 레이아웃 (Gap)

### 간격 토큰

| 토큰 | 값 | 용도 |
|------|----|------|
| Gap-S | 16px | 컴포넌트 내부 요소 간격 |
| Gap-M | 32px | 섹션 간 간격 |

### 마진 (Margin)

| 영역 | 값 |
|------|----|
| 좌·우 Margin | 16px |
| 상단 Margin | 16px |

### 바디 레이아웃

- 좌우 안쪽 여백: **16px**
- 콘텐츠 상단 갭: **16px (Gap-S)**
- 콘텐츠 하단 갭: **16px (Gap-S)**

---

## 5. 테두리 둥글기 (Border Radius)

| 토큰 | 값 | 용도 예시 |
|------|----|-----------|
| Full | 999px | 태그, 배지, 풀라운드 버튼 |
| Round-L | 28px | 카드, 모달 |
| Round-M | 16px | 입력 필드, 보조 카드 |
| Round-S | 8px | 소형 버튼, 인디케이터 |

---

## 6. 브레이크포인트 (Breakpoints)

| 이름 | 범위 | 기준 기기 |
|------|------|-----------|
| Mobile | ~ 767px | 스마트폰 |
| Tablet | 768px ~ 1279px | 태블릿, 소형 노트북 |
| Desktop | 1280px ~ | PC, 대형 노트북 |

### 데스크탑 최대 너비 (Max Width)

> **max-width: 768px, 가운데 정렬**
>
> 이 서비스는 카카오톡으로 링크를 공유하는 **모바일 중심 서비스**다.
> 데스크탑 환경은 부수적 지원에 해당하므로, 콘텐츠를 태블릿 최소 너비(768px)에 고정하고 좌우를 여백으로 채운다.
> 넓은 레이아웃 대응 공수를 줄이고, 어떤 화면에서도 모바일과 동일한 사용 흐름을 유지하기 위함이다.

```css
/* Mobile First */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1280px) { /* Desktop */ }

/* 데스크탑 콘텐츠 최대 너비 */
.container {
  max-width: 768px;
  margin: 0 auto;
  padding: 0 16px;
}
```

---

## 7. Z-index

채팅 UI 특성상 레이어 충돌이 잦으므로 100 단위로 명시적으로 정의한다.

| 레이어 | 값 | 예시 |
|--------|----|------|
| Base | 0 | 일반 콘텐츠, 메시지 목록 |
| Sticky | 100 | 헤더, 하단 입력창 |
| Dropdown | 200 | 툴팁, 컨텍스트 메뉴 |
| Overlay | 300 | 모달 딤 배경 |
| Modal | 400 | 바텀시트, 팝업 |
| Toast | 500 | 토스트, 알림 메시지 |

---

## 8. iOS Safe Area

카카오톡 인앱 브라우저에서 홈 인디케이터 영역이 하단 입력창을 가리는 문제를 방지한다.

```html
<!-- viewport-fit=cover 필수 -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
/* 하단 입력창에 적용 */
.input-bar {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
```

---

## 9. 터치 타깃 (Touch Target)

- 최소 크기: **48×48px** (Google Material Design / Apple HIG 기준)
- 아이콘 등 시각 요소가 작더라도 `padding`으로 터치 영역을 48px 이상 확보한다.

```css
/* 예: 16px 아이콘 버튼의 터치 영역 확보 */
.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 48px;
}
```

---

## 10. 로딩 & 스켈레톤 (Loading & Skeleton)

### 용어 정의

| 용어 | 설명 |
|------|------|
| Skeleton UI | 콘텐츠 로딩 전 회색 플레이스홀더 블록 |
| Shimmer | 스켈레톤에 빛이 흐르는 애니메이션 효과 |
| Streaming | AI가 토큰 단위로 텍스트를 순차 출력하는 방식 |
| Typing Indicator | `···` 버블로 응답 대기 중임을 표시 |

### AI 채팅 응답 대기 시

1. **응답 대기 중** — Typing Indicator (`···` 버블) 또는 Shimmer 블록 표시
2. **응답 시작** — Streaming 방식으로 텍스트 순차 출력
3. **에러 발생** — Semantic-Red 계열 인라인 메시지로 처리

### 일반 콘텐츠 로딩 시

- 리스트, 카드 등 데이터 로딩 중에는 Skeleton + Shimmer 처리
- 배경색: `#EBEBEB` (Shimmer 기준 컬러), 라운드는 컴포넌트 Border Radius 동일 적용
