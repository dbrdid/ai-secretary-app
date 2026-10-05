/**
 * 반복 일정 펼치기 — DTL-CAL-003(반복: 매주/매월). 캘린더 보기(REQ-CAL-001)와 날짜별 목록(DTL-CAL-002)이 쓴다.
 *
 * 결정과 이유
 * - 반복 일정은 규칙 하나로 저장하고, 볼 때 필요한 기간만 펼친다. 회차마다 항목을 저장하면 끝없는 반복을 담을 수
 *   없고, 한 번 고칠 때 모든 회차를 고쳐야 한다.
 * - 시각 일정은 일정의 시간대(schedule.timeZone)에서 벽시계로 센다. '매주 월 09:00'은 서머타임이 바뀌어도 09:00이다.
 *   길이는 첫 회의 길이(밀리초)를 그대로 쓴다. 둘 다 RFC 5545(iCalendar)와 같아서 나중에 다른 캘린더와 주고받아도
 *   회차가 어긋나지 않는다.
 * - 종일 일정은 날짜로만 센다(시간대 무관). 길이는 첫 회의 날 수를 그대로 쓴다.
 * - 첫 회보다 앞선 회차는 만들지 않는다.
 * - [합의 필요] 매월 29~31일에 그 날이 없는 달: 건너뛸지('skip', RFC 5545·구글 캘린더 방식) 말일로 당길지('lastDay')가
 *   원문에 없다. 규칙을 인자로 받아, 어느 쪽으로 정해져도 이 파일은 그대로 쓴다(docs/open-decisions.md OD-13).
 * - [합의 필요] 반복 끝(날짜·횟수)과 한 회만 고치기·지우기는 원문에 없다. 지금은 반복 전체가 한 항목이다(OD-13).
 */
import type { EventContent, EventSchedule } from '../contracts/items.ts';
import {
  addDays,
  daysBetween,
  daysInMonth,
  instantMs,
  localDateFrom,
  localDateOf,
  localDateParts,
  localDateTimeOf,
  startOfLocalDay,
  toInstant,
  zonedDateTimeToInstant,
  type LocalDate,
  type TimeZone,
} from '../contracts/time.ts';

export type MonthEndRule = 'skip' | 'lastDay';

/** 펼친 한 회. index는 첫 회가 0이고 매주는 몇 주 뒤, 매월은 몇 달 뒤다('skip'으로 건너뛴 달도 센다). */
export type Occurrence<E extends EventContent = EventContent> = {
  readonly event: E;
  readonly index: number;
  readonly schedule: EventSchedule;
};

/** 계정 시간대의 날짜 범위(양 끝 포함). 날짜별 목록이면 from = to. */
export type DateRange = { readonly from: LocalDate; readonly to: LocalDate; readonly timeZone: TimeZone };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MINUTE_MS = 60 * 1000;

/** 범위와 겹치는 회차를 순서대로 돌려준다. 반복이 없으면 첫 회 하나만 본다. */
export function occurrencesInRange<E extends EventContent>(event: E, range: DateRange, monthEnd: MonthEndRule): Occurrence<E>[] {
  if (range.to < range.from) return [];
  return event.schedule.kind === 'allDay'
    ? allDayOccurrences(event, event.schedule, range, monthEnd)
    : timedOccurrences(event, event.schedule, range, monthEnd);
}

const monthIndex = (date: LocalDate): number => {
  const [y, m] = localDateParts(date);
  return y * 12 + (m - 1);
};

/** 기준 달에서 k달 뒤의 [년, 월]. */
function monthAfter(year: number, month: number, k: number): [number, number] {
  const total = year * 12 + (month - 1) + k;
  return [Math.floor(total / 12), (total % 12) + 1];
}

/** 그 달에서 쓸 날짜. 그 날이 없는 달이면 규칙대로 건너뛰거나(null) 말일로 당긴다. */
function dayInMonth(year: number, month: number, day: number, rule: MonthEndRule): number | null {
  const last = daysInMonth(year, month);
  if (day <= last) return day;
  return rule === 'skip' ? null : last;
}

function allDayOccurrences<E extends EventContent>(
  event: E,
  s: Extract<EventSchedule, { kind: 'allDay' }>,
  range: DateRange,
  monthEnd: MonthEndRule,
): Occurrence<E>[] {
  const spanDays = daysBetween(s.startDate, s.endDate);
  const out: Occurrence<E>[] = [];
  const push = (index: number, startDate: LocalDate) => {
    const endDate = addDays(startDate, spanDays);
    // 'YYYY-MM-DD'는 글자 순서가 날짜 순서와 같다.
    if (startDate <= range.to && endDate >= range.from) out.push({ event, index, schedule: { kind: 'allDay', startDate, endDate } });
  };

  const freq = event.recurrence?.freq;
  if (freq === undefined) {
    push(0, s.startDate);
  } else if (freq === 'weekly') {
    // k주 뒤 회차가 겹치려면 start + 7k ≤ to 이고 end + 7k ≥ from.
    const first = Math.max(0, Math.ceil(daysBetween(s.endDate, range.from) / 7));
    const last = Math.floor(daysBetween(s.startDate, range.to) / 7);
    for (let k = first; k <= last; k++) push(k, addDays(s.startDate, 7 * k));
  } else {
    const [y, m, d] = localDateParts(s.startDate);
    // 길이만큼 앞선 달에서 시작한 회차도 범위에 걸칠 수 있어 그 달부터 본다.
    const first = Math.max(0, monthIndex(addDays(range.from, -spanDays)) - monthIndex(s.startDate));
    for (let k = first; ; k++) {
      const [yy, mm] = monthAfter(y, m, k);
      if (localDateFrom(yy, mm, 1) > range.to) break;
      const day = dayInMonth(yy, mm, d, monthEnd);
      if (day !== null) push(k, localDateFrom(yy, mm, day));
    }
  }
  return out;
}

function timedOccurrences<E extends EventContent>(
  event: E,
  s: Extract<EventSchedule, { kind: 'timed' }>,
  range: DateRange,
  monthEnd: MonthEndRule,
): Occurrence<E>[] {
  const baseStart = instantMs(s.start);
  const durationMs = instantMs(s.end) - baseStart;
  // 형식이 틀린 값이면 아래 반복문이 끝나지 않는다. 저장 전 검사(checkContent)를 거치지 않은 값에 대한 방어.
  if (!Number.isFinite(baseStart) || !Number.isFinite(durationMs)) return [];

  // 범위는 계정 시간대의 [from 0시, to 다음 날 0시).
  const windowStart = instantMs(startOfLocalDay(range.from, range.timeZone));
  const windowEnd = instantMs(startOfLocalDay(addDays(range.to, 1), range.timeZone));
  const out: Occurrence<E>[] = [];
  const push = (index: number, startMs: number) => {
    const endMs = startMs + durationMs;
    // 길이가 0인 일정(시작 = 끝)은 그 순간이 범위 안일 때만 겹친다.
    const overlaps = startMs < windowEnd && (endMs > windowStart || (endMs === startMs && startMs >= windowStart));
    if (overlaps) {
      out.push({ event, index, schedule: { kind: 'timed', start: toInstant(startMs), end: toInstant(endMs), timeZone: s.timeZone } });
    }
  };

  const freq = event.recurrence?.freq;
  if (freq === undefined) {
    push(0, baseStart);
    return out;
  }

  // 회차 시작 = 일정 시간대에서 같은 벽시계 시각. 분 아래(초·밀리초)는 첫 회 값을 그대로 붙인다.
  const base = localDateTimeOf(s.start, s.timeZone);
  const subMinute = ((baseStart % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
  const startOn = (k: number, date: LocalDate): number =>
    k === 0 ? baseStart : instantMs(zonedDateTimeToInstant(date, base.time, s.timeZone)) + subMinute;

  if (freq === 'weekly') {
    // 서머타임으로 한 주가 한 시간쯤 늘거나 줄 수 있어 한 주 앞에서부터 센다.
    const first = Math.max(0, Math.floor((windowStart - durationMs - baseStart) / WEEK_MS) - 1);
    for (let k = first; ; k++) {
      const startMs = startOn(k, addDays(base.date, 7 * k));
      if (startMs >= windowEnd) break;
      push(k, startMs);
    }
    return out;
  }

  const [y, m, d] = localDateParts(base.date);
  // 범위 시작에서 길이만큼 앞선 순간이 일정 시간대로 며칠인지 보고, 그 전달부터 센다.
  const earliest = localDateOf(toInstant(windowStart - Math.max(durationMs, 0)), s.timeZone);
  const first = Math.max(0, monthIndex(earliest) - monthIndex(base.date) - 1);
  for (let k = first; ; k++) {
    const [yy, mm] = monthAfter(y, m, k);
    if (instantMs(startOfLocalDay(localDateFrom(yy, mm, 1), s.timeZone)) >= windowEnd) break;
    const day = dayInMonth(yy, mm, d, monthEnd);
    if (day === null) continue;
    const startMs = startOn(k, localDateFrom(yy, mm, day));
    if (startMs >= windowEnd) break;
    push(k, startMs);
  }
  return out;
}
