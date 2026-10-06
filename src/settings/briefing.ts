/**
 * 브리핑 설정 값 — DTL-SET-011(일간), DTL-SET-012(주간). 상위 REQ-SET-018·019.
 * 원문
 * - DTL-SET-011: 일간 브리핑 수신 여부(기본 On)와 수신 시각(기본 08:00)을 설정한다. 시각은 00:00~23:30
 *   범위에서 30분 단위로 선택한다.
 * - DTL-SET-012: 주간 브리핑 수신 여부(기본 Off)를 설정한다. On으로 켜면 요일 1개와 시각을 선택하는 필드를
 *   노출하며, 초기 제안값은 월요일 08:30이다.
 * 여기서는 값과 검사만 다룬다. 서버 저장은 DTL-SET-004, 실제 발송은 단계 8(REQ-BRF-001)이다.
 *
 * 결정과 이유
 * - 시각은 'HH:mm' 벽시계 값으로 두고 시간대는 설정에 따로 둔다(DTL-SET-013). UTC 순간으로 바꿔 두면 서머타임이나
 *   시간대 변경 때 '아침 8시'가 다른 시각으로 밀린다.
 * - 주간 브리핑은 켜진 상태에 요일·시각이 반드시 있도록 타입을 나눴다. 켜졌는데 요일이 없는 저장값을 막는다.
 *   꺼진 상태 { enabled: false }는 건너뛰기 기본값(onboarding/skipOnboarding.ts)과 그대로 맞는다.
 * - 일간 시각은 꺼져 있어도 남기고 검사한다. 다시 켤 때 그 시각을 쓰기 때문이다.
 * - [임시 가정] 주간 시각은 'HH:mm'이면 받는다. 30분 단위는 DTL-SET-011(일간)에만 적혀 있다. 논의 OD-09.
 * - [임시 가정] 주간을 끄면 고른 요일·시각을 지우지 않는다. 다시 켜면 그 값을, 없으면 월요일 08:30을 제안한다.
 *   원문 '초기 제안값'이 처음 켤 때만인지 켤 때마다인지 정해지지 않았다. 논의 OD-09.
 */
import { isLocalTime, isTimeZone, WEEKDAYS, type LocalTime, type TimeZone, type Weekday } from '../contracts/time.ts';

export type DailyBriefing = { readonly enabled: boolean; readonly time: LocalTime };

export type WeeklyBriefing =
  | { readonly enabled: true; readonly weekday: Weekday; readonly time: LocalTime }
  /** 꺼짐. 전에 고른 요일·시각이 있으면 둘 다 남는다([임시 가정]). */
  | { readonly enabled: false; readonly weekday?: Weekday; readonly time?: LocalTime };

/** DTL-SET-011 기본값. DTL-SET-003(건너뛰기) 기본값과 같다. */
export const DAILY_BRIEFING_DEFAULT: DailyBriefing = { enabled: true, time: '08:00' };
/** DTL-SET-012 기본값(꺼짐). */
export const WEEKLY_BRIEFING_DEFAULT: WeeklyBriefing = { enabled: false };
/** DTL-SET-012 '초기 제안값'. */
export const WEEKLY_BRIEFING_SUGGESTION = { weekday: 'mon', time: '08:30' } as const satisfies { weekday: Weekday; time: LocalTime };

/** DTL-SET-011 선택지 48개: '00:00', '00:30', …, '23:30'. 화면의 시각 선택기가 이 목록을 쓴다. */
export const DAILY_BRIEFING_TIMES: readonly LocalTime[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
);

/** 00:00~23:30 사이의 30분 단위인지(DTL-SET-011). */
export function isDailyBriefingTime(time: string): boolean {
  return isLocalTime(time) && (time.endsWith(':00') || time.endsWith(':30'));
}

export function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}

/** 주간 브리핑을 켠다. 이미 켜져 있으면 그대로 둔다. */
export function turnOnWeekly(current: WeeklyBriefing): WeeklyBriefing {
  if (current.enabled) return current;
  if (current.weekday !== undefined && current.time !== undefined) {
    return { enabled: true, weekday: current.weekday, time: current.time };
  }
  return { enabled: true, ...WEEKLY_BRIEFING_SUGGESTION };
}

/** 주간 브리핑을 끈다. 고른 값은 남긴다([임시 가정], OD-09). */
export function turnOffWeekly(current: WeeklyBriefing): WeeklyBriefing {
  if (!current.enabled) return current;
  return { enabled: false, weekday: current.weekday, time: current.time };
}

/**
 * 주간 요일·시각은 켜져 있으면 반드시 있어야 한다. 꺼져 있으면 없어도 되지만, 남긴 값이 있으면 둘 다 있고 맞아야
 * 한다(하나만 있으면 빠진 쪽을 알린다).
 */
export type BriefingProblem = 'invalidDailyTime' | 'invalidWeekday' | 'invalidWeeklyTime' | 'invalidTimeZone';

export type BriefingSettings = {
  readonly dailyBriefing: DailyBriefing;
  readonly weeklyBriefing: WeeklyBriefing;
  readonly timeZone: TimeZone;
};

/**
 * 저장 전 검사. 문제가 없으면 빈 배열. 화면(저장 버튼)과 서버(마지막 방어)가 같은 규칙을 쓰게 한다.
 * 저장된 값은 JSON으로 오가므로 타입이 보장하지 않는 값(모르는 요일 문자열 등)도 여기서 거른다.
 */
export function checkBriefingSettings(settings: BriefingSettings): readonly BriefingProblem[] {
  const problems: BriefingProblem[] = [];
  if (!isDailyBriefingTime(settings.dailyBriefing.time)) problems.push('invalidDailyTime');

  const weekly = settings.weeklyBriefing;
  const hasWeekday = weekly.weekday !== undefined;
  const hasTime = weekly.time !== undefined;
  if (weekly.enabled || hasWeekday || hasTime) {
    if (!hasWeekday || !isWeekday(weekly.weekday as string)) problems.push('invalidWeekday');
    if (!hasTime || !isLocalTime(weekly.time as string)) problems.push('invalidWeeklyTime');
  }

  if (!isTimeZone(settings.timeZone)) problems.push('invalidTimeZone');
  return problems;
}
