/**
 * 날짜별 목록 — DTL-CAL-002(상위 REQ-CAL-002).
 * 원문: 월간 뷰에서 특정 날짜(예: 15일) 탭 시, 해당 일자의 일정, 마감 할 일, 관련 메모 목록을 모바일 폭에서는
 * 하단 바텀 시트로, 데스크톱 폭에서는 우측 패널로 띄운다. 시트·패널은 화면 몫이고 여기서는 목록만 만든다.
 *
 * 결정과 이유
 * - '그날'은 계정 시간대(설정의 timeZone)로 센다(contracts/time.ts). 기기 시간대를 스스로 읽지 않는다.
 * - 일정: 그날과 겹치는 회차 전부. 여러 날에 걸친 일정과 자정을 넘는 시각 일정은 걸친 날마다 나온다. 반복 일정은
 *   calendar/recurrence.ts로 펼친다. 종일 일정을 먼저, 시각 일정은 시작 순으로 둔다.
 * - 할 일: 마감이 그날인 것. 완료한 것도 넣는다 — DTL-TSK-002가 완료를 취소선으로 보이게 하므로 목록에서 빼지
 *   않는다. 시각 마감을 시각 순으로 먼저, 날짜만 있는 마감을 뒤에 둔다.
 * - 휴지통 항목은 넣지 않는다.
 * - [합의 필요] '관련 메모'가 어떤 메모인지 원문에 없다. 기준을 인자로 받는다(docs/open-decisions.md OD-15).
 *   정해지기 전에는 noRelatedMemos를 넘겨 빈 목록을 보인다. 임시 기준을 지어 넣지 않는다 — 한번 보이기 시작한
 *   메모가 기준 확정 뒤 사라지면 사용자가 데이터를 잃은 것으로 오해한다.
 */
import type { EventItem, Item, MemoItem, TaskItem } from '../contracts/items.ts';
import { instantMs, localDateOf, type LocalDate, type TimeZone } from '../contracts/time.ts';
import { occurrencesInRange, type MonthEndRule, type Occurrence } from './recurrence.ts';

export type DayContext = {
  readonly date: LocalDate;
  readonly timeZone: TimeZone;
  readonly events: readonly Occurrence<EventItem>[];
  readonly tasks: readonly TaskItem[];
};

/** 이 메모를 그날 목록에 넣을지. 그날의 일정·할 일을 함께 받아 '그 일정의 근거 메모' 같은 기준도 쓸 수 있다. */
export type RelatedMemoRule = (memo: MemoItem, day: DayContext) => boolean;

/** 기준이 정해지기 전(OD-15)에 쓰는 값: 메모를 넣지 않는다. */
export const noRelatedMemos: RelatedMemoRule = () => false;

export type DayAgenda = DayContext & { readonly memos: readonly MemoItem[] };

export type DayAgendaOptions = {
  /** 계정 설정의 시간대 */
  readonly timeZone: TimeZone;
  readonly monthEnd: MonthEndRule;
  readonly relatedMemo: RelatedMemoRule;
};

export function dayAgenda(items: readonly Item[], date: LocalDate, options: DayAgendaOptions): DayAgenda {
  const { timeZone } = options;
  const live = items.filter((i) => i.deletedAt === null);

  const events = live
    .filter((i): i is EventItem => i.kind === 'event')
    .flatMap((e) => occurrencesInRange(e, { from: date, to: date, timeZone }, options.monthEnd))
    .sort(compareOccurrences);

  const tasks = live
    .filter((i): i is TaskItem => i.kind === 'task')
    .filter((t) => t.due !== null && dueDate(t, timeZone) === date)
    .sort(compareTasksByDue);

  const context: DayContext = { date, timeZone, events, tasks };
  const memos = live.filter((i): i is MemoItem => i.kind === 'memo').filter((m) => options.relatedMemo(m, context));
  return { ...context, memos };
}

function dueDate(task: TaskItem, timeZone: TimeZone): LocalDate | null {
  const due = task.due;
  if (due === null) return null;
  return due.kind === 'date' ? due.date : localDateOf(due.at, timeZone);
}

// sort는 안정 정렬이라 기준이 같으면 저장소가 준 순서(만든 순서)가 남는다.
function compareOccurrences(a: Occurrence<EventItem>, b: Occurrence<EventItem>): number {
  const sa = a.schedule;
  const sb = b.schedule;
  if (sa.kind === 'allDay' || sb.kind === 'allDay') {
    if (sa.kind === sb.kind) return 0;
    return sa.kind === 'allDay' ? -1 : 1;
  }
  return instantMs(sa.start) - instantMs(sb.start);
}

function compareTasksByDue(a: TaskItem, b: TaskItem): number {
  const da = a.due;
  const db = b.due;
  if (da?.kind === 'instant' && db?.kind === 'instant') return instantMs(da.at) - instantMs(db.at);
  if (da?.kind === 'instant') return -1;
  if (db?.kind === 'instant') return 1;
  return 0;
}
