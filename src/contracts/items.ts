/**
 * 저장되는 일정·할 일·메모의 공통 형태 — 단계 0 계약. 기능별 필드(반복·알림·중요도 등)는 해당 단계에서
 * 더한다. 여기에는 여러 기능이 함께 기대는 뼈대만 둔다.
 *
 * 결정과 이유
 * - 생성 출처와 확인 상태를 provenance로 나눈다(REQ-SET-015, DTL-SET-009). 자동 저장된 AI 결과와 사용자가
 *   확정한 결과를 한 값으로 뭉치면 'AI 생성' 배지를 붙일 근거가 사라진다. 직접 쓴 항목에는 확인 상태
 *   자체를 두지 않아, 직접 쓴 항목에 배지가 붙는 조합을 타입에서 막았다.
 * - 검토 대기 중인 AI 후보는 이 타입이 아니다. 확정·자동 저장 전의 후보가 캘린더·할 일 목록에 섞이면
 *   안 되기 때문이다(후보 카드는 review/resultCard.ts).
 * - 일정 시각은 종일/시각 지정 두 가지다. resultCard의 when 한 칸에는 종료 시각과 시간대가 없어서
 *   DTL-CAL-003(시작/종료 일시)을 담을 수 없다.
 * - 삭제·버전 같은 저장소가 정하는 값은 StoredMeta로 따로 둔다. 호출하는 쪽이 id나 version을 지어내
 *   보내는 일을 타입에서 막기 위해서다.
 * [임시 가정] 제목(일정·할 일)과 본문(메모)은 앞뒤 공백을 빼고 비어 있으면 받지 않는다 — resultCard와 같은
 * 기준이며 원문 규칙은 없다. 시각 지정 일정은 종료가 시작과 같아도 받는다(원문에 최소 길이 없음).
 * [합의 필요] 자동 저장된 항목을 사용자가 열어 고치면 '사용자 확정'으로 바뀌는지는 원문에 없다(docs/open-decisions.md OD-17).
 * 단계 3에서 일정에 반복(recurrence)·알림(reminder)을 더했다(DTL-CAL-003). 없으면 null로 보낸다 — place처럼
 * 칸을 빼지 않고 null로 두어, 받는 쪽이 '없음'과 '빠뜨림'을 구별할 수 있게 한다.
 */
import { isWellFormedEvidence, type EvidenceLocation } from './evidence.ts';
import { instantMs, isInstant, isLocalDate, isTimeZone, type Instant, type LocalDate, type TimeZone } from './time.ts';

export type Provenance =
  | { readonly origin: 'manual' }
  | {
      readonly origin: 'ai';
      readonly confirmation: 'autoSaved' | 'userConfirmed';
      /** 분석 작업 하나에서 후보가 여러 개 나온다(메모 하나 → 일정 + 할 일). */
      readonly analysisId: string;
      /** 후보마다 하나. 재시도로 같은 후보가 두 번 저장되지 않게 하는 열쇠다. */
      readonly candidateId: string;
      /** 근거를 못 찾은 결과는 빈 배열이다. 위치를 지어내 채우지 않는다. */
      readonly evidence: readonly EvidenceLocation[];
    };

export type EventSchedule =
  /** endDate까지 포함한다. 하루짜리면 startDate와 같다. */
  | { readonly kind: 'allDay'; readonly startDate: LocalDate; readonly endDate: LocalDate }
  /** timeZone은 입력한 사람의 시간대. 화면 표시와 반복 계산(단계 3)에 쓴다. */
  | { readonly kind: 'timed'; readonly start: Instant; readonly end: Instant; readonly timeZone: TimeZone };

export type TaskDue =
  | { readonly kind: 'date'; readonly date: LocalDate }
  | { readonly kind: 'instant'; readonly at: Instant; readonly timeZone: TimeZone };

/**
 * DTL-CAL-003 반복(매주/매월). 매주는 첫 일정의 요일, 매월은 첫 일정의 날짜를 따른다. 펼치는 규칙은
 * calendar/recurrence.ts. [합의 필요] 반복 끝(날짜·횟수)과 한 회만 고치기는 원문에 없어 아직 없다(OD-13).
 */
export type Recurrence = { readonly freq: 'weekly' | 'monthly' };

/**
 * DTL-CAL-003 알림. 시작 몇 분 전인지(0이면 시작할 때). 실제 발송은 단계 8.
 * [합의 필요] 고를 수 있는 선택지, 여러 개 허용, 종일 일정은 언제를 기준으로 울릴지가 원문에 없다(OD-14).
 */
export type Reminder = { readonly minutesBefore: number };

type Common = {
  readonly provenance: Provenance;
  readonly projectId: string | null;
  readonly tags: readonly string[];
};

export type EventContent = Common & {
  readonly kind: 'event';
  readonly title: string;
  readonly schedule: EventSchedule;
  readonly place: string | null;
  readonly recurrence: Recurrence | null;
  readonly reminder: Reminder | null;
};

export type TaskContent = Common & {
  readonly kind: 'task';
  readonly title: string;
  readonly due: TaskDue | null;
  /** REQ-TSK-002 완료 시각. 완료 전이면 null. */
  readonly completedAt: Instant | null;
  /** REQ-PRJ-002 담당자. 팀원 초대(단계 6)가 생기기 전에는 늘 null. */
  readonly assigneeId: string | null;
};

export type MemoContent = Common & {
  readonly kind: 'memo';
  /** REQ-INB-001: 제목 없이 내용만 쓸 수 있다. */
  readonly body: string;
};

/** 호출하는 쪽이 만들고 고치는 부분. */
export type ItemContent = EventContent | TaskContent | MemoContent;
export type ItemKind = ItemContent['kind'];

/** 저장소가 정하는 부분. */
export type StoredMeta = {
  readonly id: string;
  readonly ownerId: string;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  /** 휴지통으로 옮긴 시각(REQ-SYS-001). 휴지통에 없으면 null. */
  readonly deletedAt: Instant | null;
  /** 1부터 시작해 바뀔 때마다 1씩 는다. 다른 기기가 먼저 고친 것을 알아채는 데 쓴다. */
  readonly version: number;
};

export type Item = ItemContent & StoredMeta;
export type EventItem = Extract<Item, { readonly kind: 'event' }>;
export type TaskItem = Extract<Item, { readonly kind: 'task' }>;
export type MemoItem = Extract<Item, { readonly kind: 'memo' }>;

/**
 * 저장된 항목에서 저장소가 정한 값(StoredMeta)을 뺀다. 고치기(ItemStore.update)에 넘길 때 쓴다 — 실제 API로
 * id·version이 본문에 섞여 가지 않게 한다.
 */
export function contentOf<T extends Item>(item: T): Omit<T, keyof StoredMeta> {
  const { id: _id, ownerId: _ownerId, createdAt: _createdAt, updatedAt: _updatedAt, deletedAt: _deletedAt, version: _version, ...content } = item;
  return content;
}

export type ContentProblem =
  | 'emptyTitle'
  | 'emptyBody'
  /** 날짜·순간·시간대 형식이 틀림 */
  | 'invalidSchedule'
  | 'endBeforeStart'
  | 'invalidDue'
  | 'invalidCompletedAt'
  /** 매주·매월이 아닌 반복 */
  | 'invalidRecurrence'
  /** 0 이상의 정수(분)가 아닌 알림 */
  | 'invalidReminder'
  /** AI 출처의 ID가 비었거나 근거 위치 모양이 틀림 */
  | 'invalidProvenance';

/** 저장 전 검사. 문제가 없으면 빈 배열. 화면(입력 중)과 저장소(마지막 방어)가 같은 규칙을 쓰게 한다. */
export function checkContent(content: ItemContent): readonly ContentProblem[] {
  const problems: ContentProblem[] = [];
  const p = content.provenance;
  if (p.origin === 'ai' && (p.analysisId === '' || p.candidateId === '' || !p.evidence.every(isWellFormedEvidence))) {
    problems.push('invalidProvenance');
  }
  switch (content.kind) {
    case 'event':
      if (content.title.trim() === '') problems.push('emptyTitle');
      problems.push(...checkSchedule(content.schedule));
      // 저장값은 JSON으로 오가므로 타입 밖의 값(freq: 'daily' 등)도 여기서 거른다.
      if (content.recurrence !== null && content.recurrence.freq !== 'weekly' && content.recurrence.freq !== 'monthly') {
        problems.push('invalidRecurrence');
      }
      if (content.reminder !== null && !(Number.isSafeInteger(content.reminder.minutesBefore) && content.reminder.minutesBefore >= 0)) {
        problems.push('invalidReminder');
      }
      break;
    case 'task':
      if (content.title.trim() === '') problems.push('emptyTitle');
      if (content.due !== null && !isValidDue(content.due)) problems.push('invalidDue');
      if (content.completedAt !== null && !isInstant(content.completedAt)) problems.push('invalidCompletedAt');
      break;
    case 'memo':
      if (content.body.trim() === '') problems.push('emptyBody');
      break;
  }
  return problems;
}

function checkSchedule(schedule: EventSchedule): ContentProblem[] {
  if (schedule.kind === 'allDay') {
    if (!isLocalDate(schedule.startDate) || !isLocalDate(schedule.endDate)) return ['invalidSchedule'];
    // 'YYYY-MM-DD'는 글자 순서가 날짜 순서와 같다.
    return schedule.endDate < schedule.startDate ? ['endBeforeStart'] : [];
  }
  if (!isInstant(schedule.start) || !isInstant(schedule.end) || !isTimeZone(schedule.timeZone)) return ['invalidSchedule'];
  // 밀리초 유무가 섞일 수 있어 글자로 비교하지 않는다.
  return instantMs(schedule.end) < instantMs(schedule.start) ? ['endBeforeStart'] : [];
}

function isValidDue(due: TaskDue): boolean {
  return due.kind === 'date' ? isLocalDate(due.date) : isInstant(due.at) && isTimeZone(due.timeZone);
}

/** DTL-SET-009: 자동 저장된 AI 항목에만 'AI 생성' 배지를 붙인다. 확정한 AI 결과·직접 쓴 항목에는 없다. */
export function showsAiBadge(item: Pick<ItemContent, 'provenance'>): boolean {
  const p = item.provenance;
  return p.origin === 'ai' && p.confirmation === 'autoSaved';
}
