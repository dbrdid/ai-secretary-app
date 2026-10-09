/**
 * 요금제별 제공 범위와 이용 한도 — DTL-PAY-001(상위 REQ-PAY-001), REQ-PAY-003(이용량 확인), REQ-PAY-004(한도 초과 안내),
 * REQ-PAY-002(처음 가입하면 무료).
 * 원문 DTL-PAY-001(스토리보드 S28): 무료 / Pro / Team
 * - 녹음·음성 변환 월 300 / 2,000 / 5,000분, AI 요약 월 10회 / 무제한 / 무제한, AI 질문 월 20 / 300 / 1,000회
 * - 키워드 추출 모두 가능, 회의록·강의노트 생성 기본 / 고급 / 고급, AI 복습 문제 불가 / 가능 / 가능
 *   (B2B 표현과 맞지 않아 명세서 대기 목록에 있다. 코드 이름은 meetingNotes·reviewQuiz로 두고 표시 문구는 화면이 정한다.)
 * - 녹음 검색 최근 7일 / 전체 / 전체, 클라우드 저장 1GB / 20GB / 100GB, 광고 있음 / 없음 / 없음, 가격 0 / 19,000 / 49,000원
 *
 * 결정
 * - 2026-10-06 최재원: 웹과 앱을 둘 다 만들고, 유료(Pro·Team) 사용자만 웹과 앱이 연동된다. 그래서 crossDeviceSync는
 *   무료 false, Pro·Team true다. 원문 표의 '여러 기기 동기화' 행이 모호하다고 남아 있던 것을 이 결정으로 채웠다.
 *   [합의 필요] 명세서 REQ-SET-009(설정은 다른 기기에서도 유지)·REQ-SYS-004(기기 간 동기화)는 모든 사용자 대상으로 읽힌다.
 *   무료 사용자도 계정 설정(초기 설정 완료 여부 등)은 서버에 저장되는지, 데이터만 막는지 명세서를 맞춰야 한다.
 * - [합의 필요] Team 49,000원이 1인당인지 조직당인지 명세서 대기 목록에 남아 있다. 가격은 표시용으로만 두고 계산에 쓰지 않는다.
 * - '월'이 언제 다시 채워지는지(결제일 기준·달력 기준)는 원문에 없다. 다시 채워지는 시각은 서버가 알려 준 값을 받는다.
 * - 한도 판단은 서버가 한다. 화면의 판단은 버튼을 미리 끄고 안내하는 용도다.
 */

export const PLANS = ['free', 'pro', 'team'] as const;
export type Plan = (typeof PLANS)[number];

/** REQ-PAY-002: 처음 가입한 사용자는 무료 요금제다. */
export const DEFAULT_PLAN: Plan = 'free';

/** 월 단위로 세는 이용량 */
export const METERS = ['recordingMinutes', 'aiSummaries', 'aiQuestions'] as const;
export type Meter = (typeof METERS)[number];

/** null = 무제한 */
export type MonthlyLimits = Readonly<Record<Meter, number | null>>;

export type PlanSpec = {
  readonly label: string;
  readonly monthly: MonthlyLimits;
  readonly keywordExtraction: boolean;
  readonly meetingNotes: 'basic' | 'advanced';
  readonly reviewQuiz: boolean;
  /** 녹음 검색 범위. null = 전체 기간 */
  readonly recordingSearchDays: number | null;
  readonly storageBytes: number;
  readonly ads: boolean;
  /** 웹↔앱 연동(2026-10-06 결정) */
  readonly crossDeviceSync: boolean;
  /** 표시용 월 가격(원). Team은 1인당·조직당 미정. */
  readonly priceKrw: number;
};

const GB = 1024 ** 3;

export const PLAN_SPECS: Readonly<Record<Plan, PlanSpec>> = {
  free: {
    label: '무료',
    monthly: { recordingMinutes: 300, aiSummaries: 10, aiQuestions: 20 },
    keywordExtraction: true,
    meetingNotes: 'basic',
    reviewQuiz: false,
    recordingSearchDays: 7,
    storageBytes: 1 * GB,
    ads: true,
    crossDeviceSync: false,
    priceKrw: 0,
  },
  pro: {
    label: 'Pro',
    monthly: { recordingMinutes: 2_000, aiSummaries: null, aiQuestions: 300 },
    keywordExtraction: true,
    meetingNotes: 'advanced',
    reviewQuiz: true,
    recordingSearchDays: null,
    storageBytes: 20 * GB,
    ads: false,
    crossDeviceSync: true,
    priceKrw: 19_000,
  },
  team: {
    label: 'Team',
    monthly: { recordingMinutes: 5_000, aiSummaries: null, aiQuestions: 1_000 },
    keywordExtraction: true,
    meetingNotes: 'advanced',
    reviewQuiz: true,
    recordingSearchDays: null,
    storageBytes: 100 * GB,
    ads: false,
    crossDeviceSync: true,
    priceKrw: 49_000,
  },
};

/** REQ-PAY-003: 남은 양. 무제한이면 null. 이미 넘었으면 0. */
export function remaining(plan: Plan, meter: Meter, used: number): number | null {
  const limit = PLAN_SPECS[plan].monthly[meter];
  return limit === null ? null : Math.max(0, limit - used);
}

export type UsageCheck =
  | { readonly allowed: true }
  /** REQ-PAY-004: 한도를 다 썼다. resetsAt(서버가 알려 준 다음 충전 시각)과 요금제 변경을 안내한다. */
  | { readonly allowed: false; readonly meter: Meter; readonly limit: number; readonly resetsAt: string; readonly upgradeTo: Plan | null };

/**
 * amount만큼 더 써도 되는지. 녹음은 분 단위로 넘긴다.
 * [해석] 한도를 조금이라도 넘게 되면 막는다(남은 양보다 큰 요청은 받지 않는다). 녹음처럼 쓰는 도중 한도에 닿는 경우를 어떻게
 * 끊을지(그 자리에서 멈춤 / 이번 녹음은 끝까지)는 원문에 없어 화면·서버 담당과 정한다.
 */
export function checkUsage(plan: Plan, meter: Meter, used: number, amount: number, resetsAt: string): UsageCheck {
  const limit = PLAN_SPECS[plan].monthly[meter];
  if (limit === null || used + amount <= limit) return { allowed: true };
  return { allowed: false, meter, limit, resetsAt, upgradeTo: nextPlanWithMore(plan, meter) };
}

/** 이 이용량을 더 주는 바로 위 요금제. 없으면 null. */
function nextPlanWithMore(plan: Plan, meter: Meter): Plan | null {
  const current = PLAN_SPECS[plan].monthly[meter];
  for (const candidate of PLANS.slice(PLANS.indexOf(plan) + 1)) {
    const limit = PLAN_SPECS[candidate].monthly[meter];
    if (limit === null || (current !== null && limit > current)) return candidate;
  }
  return null;
}

/** 녹음 검색 범위 안인지(무료는 최근 7일). recordedDaysAgo는 오늘 녹음이면 0. */
export function canSearchRecording(plan: Plan, recordedDaysAgo: number): boolean {
  const days = PLAN_SPECS[plan].recordingSearchDays;
  return days === null || recordedDaysAgo < days;
}

/** 웹↔앱 연동을 쓸 수 있는지(2026-10-06 결정: 유료만). */
export function canSyncAcrossDevices(plan: Plan): boolean {
  return PLAN_SPECS[plan].crossDeviceSync;
}
