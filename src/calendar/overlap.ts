/**
 * 일정 겹침 안내와 남은 기간 — REQ-CAL-005, REQ-CAL-014.
 * 원문
 * - REQ-CAL-005: 새로 등록하거나 확정하는 일정이 기존 일정과 시간이 겹치면 시스템은 이를 알려준다.
 * - REQ-CAL-014: 사용자는 일정까지 남은 기간을 확인할 수 있다.
 *
 * 결정과 이유
 * - 알려 주기만 하고 막지 않는다(원문 '알려준다'). 저장할지는 사용자가 정한다.
 * - 반복 일정은 calendar/recurrence.ts로 펼쳐 회차마다 본다. 새 일정이 반복이면 첫 회만 본다 — 끝없는 반복끼리 비교하면
 *   언젠가는 대부분 겹쳐 쓸모 있는 안내가 되지 않는다. [합의 필요] 반복 일정끼리의 겹침 안내 범위.
 * - 시각 일정끼리만 본다. 종일 일정(휴가·공휴일 등)은 '시간'이 겹치는 일정으로 보지 않는다. [해석]
 * - 한 일정이 끝나는 순간 다음 일정이 시작하면 겹치지 않는다(10:00~11:00과 11:00~12:00).
 * - 고치는 중인 일정 자신과 휴지통 일정은 빼고 본다.
 * - 남은 기간은 계정 시간대의 날짜 차이다. 오늘 일정이면 0, 지난 일정이면 음수. 'D-3' 같은 표시 형식은 화면이 정한다.
 */
import type { EventContent, EventItem, EventSchedule } from '../contracts/items.ts';
import { daysBetween, instantMs, localDateOf, type Instant, type LocalDate, type TimeZone } from '../contracts/time.ts';
import { occurrencesInRange, type MonthEndRule, type Occurrence } from './recurrence.ts';

type TimedSchedule = Extract<EventSchedule, { readonly kind: 'timed' }>;

function overlaps(a: TimedSchedule, b: TimedSchedule): boolean {
  const as = instantMs(a.start);
  const ae = instantMs(a.end);
  const bs = instantMs(b.start);
  const be = instantMs(b.end);
  // 길이 0인 일정(시작 = 끝)은 다른 일정 안에 있을 때만 겹친다.
  if (as === ae) return bs < as && as < be;
  if (bs === be) return as < bs && bs < ae;
  return as < be && bs < ae;
}

export type OverlapOptions = {
  /** 계정 설정의 시간대. 반복 일정을 펼칠 날짜 범위를 정하는 데 쓴다. */
  readonly timeZone: TimeZone;
  readonly monthEnd: MonthEndRule;
  /** 고치는 중인 일정의 id. 자기 자신과 겹친다고 하지 않게 뺀다. */
  readonly excludeId?: string;
};

/** REQ-CAL-005: 새 일정(첫 회)과 시간이 겹치는 기존 일정의 회차. 겹치는 것이 없으면 빈 배열. */
export function findOverlaps(candidate: Pick<EventContent, 'schedule'>, existing: readonly EventItem[], options: OverlapOptions): Occurrence<EventItem>[] {
  const target = candidate.schedule;
  if (target.kind !== 'timed') return [];
  const range = { from: localDateOf(target.start, options.timeZone), to: localDateOf(target.end, options.timeZone), timeZone: options.timeZone };
  return existing
    .filter((e) => e.deletedAt === null && e.id !== options.excludeId)
    .flatMap((e) => occurrencesInRange(e, range, options.monthEnd))
    .filter((o): o is Occurrence<EventItem> & { schedule: TimedSchedule } => o.schedule.kind === 'timed' && overlaps(target, o.schedule))
    .sort((a, b) => instantMs(a.schedule.start) - instantMs(b.schedule.start));
}

/** 일정이 시작하는 날(계정 시간대). */
export function startDateOf(schedule: EventSchedule, timeZone: TimeZone): LocalDate {
  return schedule.kind === 'allDay' ? schedule.startDate : localDateOf(schedule.start, timeZone);
}

/** REQ-CAL-014: 오늘부터 일정 시작일까지 남은 날 수. 오늘이면 0, 지났으면 음수. */
export function daysUntilEvent(schedule: EventSchedule, now: Instant, timeZone: TimeZone): number {
  return daysBetween(localDateOf(now, timeZone), startDateOf(schedule, timeZone));
}
