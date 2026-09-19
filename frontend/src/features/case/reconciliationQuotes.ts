// 사건이 종결(화해 성립)됐을 때 보여줄 화해·용서에 관한 명언 모음.
export type Quote = { text: string; author: string };

export const RECONCILIATION_QUOTES: Quote[] = [
  {
    text: "먼저 사과하는 사람은 가장 용감한 사람이다. 먼저 용서하는 사람은 가장 강한 사람이다. 그리고 먼저 잊는 사람은 가장 행복한 사람이다.",
    author: "마하트마 간디 (Mahatma Gandhi)",
  },
  {
    text: "용서는 과거를 변화시킬 수는 없다. 그러나 미래를 넓혀준다.",
    author: "폴 보에즈 (Paul Boese)",
  },
  {
    text: "약한 사람은 결코 용서할 수 없다. 용서는 강한 자의 특성이다.",
    author: "마하트마 간디 (Mahatma Gandhi)",
  },
  {
    text: "우리가 타인을 용서해야 하는 이유는 그들이 용서받을 자격이 있어서가 아니라, 우리 스스로가 평화를 누릴 자격이 있기 때문이다.",
    author: "데스몬드 투투 (Desmond Tutu)",
  },
  {
    text: "화해란 과거를 덮는 것이 아니라, 과거를 안고 함께 앞으로 나아가는 것이다.",
    author: "데스몬드 투투 (Desmond Tutu)",
  },
  {
    text: "용서하지 않는 것은 내가 독약을 마시고 상대방이 죽기를 바라는 것과 같다.",
    author: "윌리엄 셰익스피어 (William Shakespeare)",
  },
  {
    text: "서로 용서하라. 당신도 용서받아야 할 인간이기 때문이다.",
    author: "요한 볼프강 폰 괴테 (Johann Wolfgang von Goethe)",
  },
  {
    text: "분노를 품고 있는 것은 다른 사람에게 던지려고 뜨거운 숯을 손에 쥐고 있는 것과 같다. 결국 상처를 입는 것은 자신이다.",
    author: "붓다 (Buddha)",
  },
  {
    text: "오직 용서만이 분노의 악순환을 끊어낼 수 있는 유일한 힘이다.",
    author: "마틴 루터 킹 주니어 (Martin Luther King Jr.)",
  },
  {
    text: "용서는 인간이 할 수 있는 가장 위대한 형태의 사랑이다. 그 보답으로 당신은 말할 수 없는 평화를 얻을 것이다.",
    author: "로버트 뮬러 (Robert Muller)",
  },
  {
    text: "우리는 사랑하는 법을 배우면서 동시에 용서하는 법도 배워야 한다.",
    author: "조지프 매튜스 (Joseph Matthews)",
  },
  {
    text: "상처를 주는 것은 인간의 일이고, 용서하는 것은 신의 일이다.",
    author: "알렉산더 포프 (Alexander Pope)",
  },
  {
    text: "사과는 부끄러운 일이 아니다. 오히려 상대를 얼마나 소중히 여기는지 보여주는 가장 아름다운 증거다.",
    author: "알베르 카뮈 (Albert Camus)",
  },
  {
    text: "진정한 화해는 갈등의 부재가 아니라, 서로의 차이를 인정하고 포용하는 능력이다.",
    author: "넬슨 만델라 (Nelson Mandela)",
  },
  {
    text: "용서란 나에게 상처 준 사람에게 주는 선물이 아니라, 내 마음의 감옥을 열고 나 자신을 자유롭게 하는 열쇠다.",
    author: "루이스 스메디스 (Lewis Smedes)",
  },
];

// 같은 사건에서는 늘 같은 명언이 나오도록, seed 문자열로 하나를 고른다.
// seed가 없으면 무작위로 하나 뽑는다.
export function pickReconciliationQuote(seed?: string): Quote {
  if (!seed) {
    return RECONCILIATION_QUOTES[
      Math.floor(Math.random() * RECONCILIATION_QUOTES.length)
    ];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % RECONCILIATION_QUOTES.length;
  return RECONCILIATION_QUOTES[index];
}
