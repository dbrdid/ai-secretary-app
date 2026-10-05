/**
 * 날짜·시각 공통 표현 — 단계 0 계약(docs/plans/2026-09-28-myClaw-development-order.md).
 * 일정(REQ-CAL)·할 일(REQ-TSK)·브리핑(REQ-BRF)·휴지통(REQ-SYS-001)이 같은 기준으로 날짜를 계산하게
 * 하려고 한곳에 모았다.
 *
 * 결정과 이유
 * - 시각이 있는 값은 UTC 순간('2026-09-28T00:30:00Z')으로 저장한다. 기기 시간대가 바뀌어도 같은 순간을
 *   가리키고, 서버·다른 기기와 비교할 때 변환이 필요 없다. 끝이 'Z'인 형식만 받는다 — 같은 순간이
 *   '+09:00' 같은 여러 모양으로 저장되면 비교·중복 검사가 어긋난다.
 * - 날짜만 있는 값(종일 일정, 날짜만 정한 마감)은 'YYYY-MM-DD'로 둔다. 자정 순간으로 바꿔 저장하면 보는
 *   시간대에 따라 하루 앞뒤로 밀려 보인다.
 * - '오늘'·'그날'은 계정에 저장한 시간대(DTL-SET-013)로 계산한다. 그래서 계산 함수는 시간대를 인자로
 *   받고 기기 시간대를 스스로 읽지 않는다.
 * - review/resultCard.ts의 when('YYYY-MM-DD HH:mm', 시간대 없음)은 AI 카드 편집용 임시 형식이다. 저장
 *   형식으로 바꾸는 변환은 AI 응답 형식이 정해질 때 붙인다.
 *
 * [합의 필요] API 담당과 같은 형식을 쓰는지는 아직 맞추지 않았다.
 */

/** 'YYYY-MM-DD' */
export type LocalDate = string;
/** 'HH:mm' (24시간) */
export type LocalTime = string;
/** 'YYYY-MM-DDTHH:mm:ssZ' 또는 밀리초가 붙은 'YYYY-MM-DDTHH:mm:ss.sssZ'(toISOString 형식). UTC만. */
export type Instant = string;
/** IANA 시간대 이름. 예: 'Asia/Seoul' */
export type TimeZone = string;

export function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

// Date 객체로 검사하지 않는다. Date.UTC는 0~99년을 1900년대로 바꿔 윤년 판정이 틀어진다.
function isCalendarDate(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?Z$/;

export function isLocalDate(text: string): boolean {
  const m = LOCAL_DATE.exec(text);
  return m !== null && isCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function isLocalTime(text: string): boolean {
  return LOCAL_TIME.test(text);
}

export function isInstant(text: string): boolean {
  const m = INSTANT.exec(text);
  return m !== null && isCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** 이 실행 환경(Intl)이 아는 IANA 이름인지. onboarding/resolveTimeZone과 같은 방법이다. */
export function isTimeZone(name: string): boolean {
  if (name === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name }); // 모르는 이름이면 RangeError
    return true;
  } catch {
    return false;
  }
}

/** 비교·경과 계산용 밀리초. */
export function instantMs(instant: Instant): number {
  return Date.parse(instant);
}

export function toInstant(ms: number): Instant {
  return new Date(ms).toISOString();
}

/** 그 순간이 해당 시간대에서 며칠인지. 예: '2026-09-28T15:00:00Z'는 서울에서 '2026-09-29'. */
export function localDateOf(instant: Instant, timeZone: TimeZone): LocalDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}

// ---------------------------------------------------------------------------------------------
// 아래는 단계 2·3(브리핑 요일, 반복 일정, 날짜별 목록)에서 더했다. 모두 시간대를 인자로 받는다.

/** 월요일부터. 화면의 요일 순서(일요일 시작 등)는 화면이 정한다. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → [년, 월, 일]. 형식이 틀리면 RangeError. */
export function localDateParts(date: LocalDate): [number, number, number] {
  const m = LOCAL_DATE.exec(date);
  if (m === null || !isLocalDate(date)) throw new RangeError(`LocalDate 형식이 아님: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function timeParts(time: LocalTime): [number, number] {
  if (!isLocalTime(time)) throw new RangeError(`LocalTime 형식이 아님: ${time}`);
  return [Number(time.slice(0, 2)), Number(time.slice(3, 5))];
}

// Date.UTC는 0~99년을 1900년대로 바꾸므로 setUTCFullYear로 만든다(위 isCalendarDate와 같은 이유).
function utcMs(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, 0);
  return d.getTime();
}

/** [년, 월, 일] → 'YYYY-MM-DD'. 달력에 있는 날짜인지는 부르는 쪽이 확인한다. */
export function localDateFrom(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 달력 날짜에 날 수를 더한다(음수면 뺀다). 달·해가 바뀌어도 맞고 시간대와 무관하다. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = localDateParts(date);
  const t = new Date(utcMs(y, m, d) + days * DAY_MS);
  return localDateFrom(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** to - from 날 수. 같은 날이면 0. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const [y1, m1, d1] = localDateParts(from);
  const [y2, m2, d2] = localDateParts(to);
  return Math.round((utcMs(y2, m2, d2) - utcMs(y1, m1, d1)) / DAY_MS);
}

export function weekdayOf(date: LocalDate): Weekday {
  const [y, m, d] = localDateParts(date);
  const sundayFirst = new Date(utcMs(y, m, d)).getUTCDay(); // 0 = 일요일
  return WEEKDAYS[(sundayFirst + 6) % 7] as Weekday;
}

// 시간대마다 포맷터를 한 번만 만든다. 반복 일정을 펼칠 때 수백 번 부르므로 만들기 비용을 아낀다.
const wallClockFormatters = new Map<TimeZone, Intl.DateTimeFormat>();
function wallClockFormatter(timeZone: TimeZone): Intl.DateTimeFormat {
  let f = wallClockFormatters.get(timeZone);
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23', // 'hour12: false'는 엔진에 따라 자정을 '24'로 준다
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    wallClockFormatters.set(timeZone, f);
  }
  return f;
}

function wallClockParts(ms: number, timeZone: TimeZone): [number, number, number, number, number, number] {
  const parts = wallClockFormatter(timeZone).formatToParts(new Date(ms));
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return [num('year'), num('month'), num('day'), num('hour'), num('minute'), num('second')];
}

/** 그 순간 그 시간대가 UTC보다 몇 밀리초 앞서는지. 서울은 +9시간. */
function offsetMs(ms: number, timeZone: TimeZone): number {
  const [y, mo, d, h, mi, s] = wallClockParts(ms, timeZone);
  return utcMs(y, mo, d, h, mi, s) - Math.floor(ms / 1000) * 1000;
}

/** 그 순간이 그 시간대에서 몇 날 몇 시 몇 분인지(초는 버린다). */
export function localDateTimeOf(instant: Instant, timeZone: TimeZone): { readonly date: LocalDate; readonly time: LocalTime } {
  const [y, mo, d, h, mi] = wallClockParts(instantMs(instant), timeZone);
  return { date: localDateFrom(y, mo, d), time: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` };
}

/**
 * 그 시간대의 벽시계 날짜·시각을 순간으로 바꾼다.
 * 서머타임 때문에 없는 시각(봄에 건너뛰는 02:30)은 건너뛰기 전 오프셋으로 읽어 뒤로 밀리고(→ 03:30),
 * 두 번 있는 시각(가을의 01:30)은 앞의 것을 고른다. RFC 5545(iCalendar)와 Temporal의 'compatible' 규칙과
 * 같아서, 나중에 다른 캘린더와 주고받아도 같은 순간이 나온다. 서울은 서머타임이 없어 영향이 없다.
 */
export function zonedDateTimeToInstant(date: LocalDate, time: LocalTime, timeZone: TimeZone): Instant {
  const [y, m, d] = localDateParts(date);
  const [h, mi] = timeParts(time);
  const wall = utcMs(y, m, d, h, mi);
  // 하루 앞뒤 오프셋 두 개로 후보를 만든다. 하루 안에 전환이 두 번 있는 시간대는 없다고 본다.
  const before = offsetMs(wall - DAY_MS, timeZone);
  const after = offsetMs(wall + DAY_MS, timeZone);
  const candidates = [...new Set([wall - before, wall - after])]
    .filter((t) => t + offsetMs(t, timeZone) === wall)
    .sort((a, b) => a - b);
  return toInstant(candidates[0] ?? wall - before);
}

/** 그 시간대에서 그날이 시작되는 순간. 자정이 없는 날(자정 서머타임 전환)은 그날의 첫 순간이다. */
export function startOfLocalDay(date: LocalDate, timeZone: TimeZone): Instant {
  return zonedDateTimeToInstant(date, '00:00', timeZone);
}
