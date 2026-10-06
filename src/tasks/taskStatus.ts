/**
 * 할 일 상태별 분류와 마감 임박 — DTL-TSK-001(상위 REQ-TSK-001), DTL-HOM-004(상위 REQ-HOM-001·007), REQ-TSK-006 뒷문장.
 * 원문
 * - DTL-TSK-001: 전체 할 일을 '오늘', '예정', '마감 임박', '기한 초과', '완료' 탭으로 나눠 목록으로 보인다.
 * - DTL-HOM-004: '마감 임박'은 마감일이 7일 이내인 일정·할 일.
 * - REQ-TSK-006: 마감일이 지나면 기한 초과로 표시한다.
 *
 * 결정과 이유
 * - '오늘'·'며칠 남았나'는 계정 시간대로 센다(contracts/time.ts). 기기 시간대를 스스로 읽지 않는다.
 * - 날짜만 있는 마감은 그날이 끝날 때까지 기한 안이다. 시각이 있는 마감은 그 시각이 지나면 바로 기한 초과다.
 * - [해석] 탭은 하나에만 들어가게 나눈다. 한 할 일이 여러 탭에 겹쳐 나오면 개수가 맞지 않는다. 앞에 있는 것이 이긴다:
 *   완료 → 기한 초과 → 오늘 → 마감 임박(내일부터 7일 뒤까지) → 예정(그 뒤, 또는 마감 없음).
 * - 홈의 '마감 임박' 개수(REQ-HOM-007)는 탭과 따로 isDueSoon으로 센다. 홈에서는 오늘 마감도 임박이다(7일 '이내').
 *   기한이 지난 것과 완료한 것은 넣지 않는다.
 * - 휴지통 항목은 넣지 않는다.
 * - [합의 필요] REQ-TSK-006의 '진행 전 → 진행 중' 단계는 아직 저장 형식(contracts/items.ts)에 칸이 없다. 서버 담당과
 *   상태 칸을 정한 뒤 더한다. 지금은 완료 시각(completedAt)만으로 완료 여부를 본다.
 */
import type { TaskContent, TaskDue, TaskItem } from '../contracts/items.ts';
import { addDays, daysBetween, instantMs, localDateOf, startOfLocalDay, type Instant, type LocalDate, type TimeZone } from '../contracts/time.ts';

export const DUE_SOON_DAYS = 7; // DTL-HOM-004

export const TASK_TABS = ['today', 'upcoming', 'dueSoon', 'overdue', 'done'] as const; // DTL-TSK-001 순서
export type TaskTab = (typeof TASK_TABS)[number];

export const TASK_TAB_LABELS: Readonly<Record<TaskTab, string>> = {
  today: '오늘',
  upcoming: '예정',
  dueSoon: '마감 임박',
  overdue: '기한 초과',
  done: '완료',
};

/** 마감일(계정 시간대 날짜). 마감이 없으면 null. */
export function dueLocalDate(due: TaskDue | null, timeZone: TimeZone): LocalDate | null {
  if (due === null) return null;
  return due.kind === 'date' ? due.date : localDateOf(due.at, timeZone);
}

/** REQ-TSK-006: 기한이 지났는지. 완료한 할 일은 지나도 기한 초과가 아니다. */
export function isOverdue(task: Pick<TaskContent, 'due' | 'completedAt'>, now: Instant, timeZone: TimeZone): boolean {
  if (task.completedAt !== null || task.due === null) return false;
  if (task.due.kind === 'instant') return instantMs(task.due.at) < instantMs(now);
  return task.due.date < localDateOf(now, timeZone);
}

/** 오늘부터 마감일까지 남은 날 수. 오늘 마감이면 0, 어제였으면 -1. 마감이 없으면 null. */
export function daysUntilDue(due: TaskDue | null, now: Instant, timeZone: TimeZone): number | null {
  const date = dueLocalDate(due, timeZone);
  return date === null ? null : daysBetween(localDateOf(now, timeZone), date);
}

/** DTL-HOM-004: 마감이 오늘부터 7일 안이고 아직 지나지 않은 미완료 할 일. */
export function isDueSoon(task: Pick<TaskContent, 'due' | 'completedAt'>, now: Instant, timeZone: TimeZone, days: number = DUE_SOON_DAYS): boolean {
  if (task.completedAt !== null || isOverdue(task, now, timeZone)) return false;
  const left = daysUntilDue(task.due, now, timeZone);
  return left !== null && left >= 0 && left <= days;
}

/** DTL-TSK-001: 이 할 일이 들어갈 탭 하나. */
export function taskTab(task: Pick<TaskContent, 'due' | 'completedAt'>, now: Instant, timeZone: TimeZone, days: number = DUE_SOON_DAYS): TaskTab {
  return tabOn(task, now, localDateOf(now, timeZone), timeZone, days);
}

// 여러 할 일을 나눌 때 '오늘'을 한 번만 계산하려고 today를 받는다(localDateOf는 매번 Intl 포맷터를 만든다).
function tabOn(task: Pick<TaskContent, 'due' | 'completedAt'>, now: Instant, today: LocalDate, timeZone: TimeZone, days: number): TaskTab {
  if (task.completedAt !== null) return 'done';
  const due = task.due;
  if (due === null) return 'upcoming';
  if (due.kind === 'instant' && instantMs(due.at) < instantMs(now)) return 'overdue';
  const left = daysBetween(today, dueLocalDate(due, timeZone) as LocalDate);
  if (left < 0) return 'overdue';
  if (left === 0) return 'today';
  if (left <= days) return 'dueSoon';
  return 'upcoming';
}

/** 탭별 목록. 휴지통 항목은 뺀다. 탭 안 순서는 마감이 이른 것부터, 마감 없는 것은 맨 뒤(만든 순서 유지). */
export function groupTasksByTab(
  tasks: readonly TaskItem[],
  now: Instant,
  timeZone: TimeZone,
  days: number = DUE_SOON_DAYS,
): Readonly<Record<TaskTab, readonly TaskItem[]>> {
  const today = localDateOf(now, timeZone);
  const keyed: Record<TaskTab, { readonly key: number; readonly task: TaskItem }[]> = { today: [], upcoming: [], dueSoon: [], overdue: [], done: [] };
  for (const task of tasks) {
    if (task.deletedAt !== null) continue;
    // 정렬 열쇠는 할 일마다 한 번만 계산한다(날짜 마감은 시간대 변환이 들어가 비싸다).
    keyed[tabOn(task, now, today, timeZone, days)].push({ key: dueSortKey(task.due, timeZone), task });
  }
  const groups = {} as Record<TaskTab, readonly TaskItem[]>;
  for (const tab of TASK_TABS) {
    // 마감 없는 것끼리(무한대)는 0이라 만든 순서가 남는다(sort는 안정 정렬).
    groups[tab] = keyed[tab].sort((a, b) => (a.key === b.key ? 0 : a.key < b.key ? -1 : 1)).map((k) => k.task);
  }
  return groups;
}

// 날짜만 있는 마감은 계정 시간대에서 그날이 끝나는 순간으로 본다. 같은 날 시각 마감 뒤, 다음 날 마감 앞에 온다.
function dueSortKey(due: TaskDue | null, timeZone: TimeZone): number {
  if (due === null) return Number.POSITIVE_INFINITY;
  if (due.kind === 'instant') return instantMs(due.at);
  return instantMs(startOfLocalDay(addDays(due.date, 1), timeZone)) - 1;
}
