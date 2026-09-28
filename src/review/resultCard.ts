/**
 * AI 분석 결과 카드의 상태 — DTL-UX-003(분류 바꾸기), DTL-UX-004(제목·날짜 인라인 수정).
 * 카드 항목은 DTL-UX-002: '일정/할일', '추출된 제목', '일시', '관련 프로젝트', '담당자', '장소'.
 * 저장(DTL-UX-006)과 화면은 이 파일 밖이다. 여기서는 카드 값과 편집 상태만 다룬다.
 *
 * DTL-UX-003 원문은 '일정(Event)' → '할 일(Task)' 또는 '일반 메모'만 적었지만, 상위 REQ-UX-003은
 * "일정, 할 일, 메모 중 다른 것으로" 바꿀 수 있다고 해서 모든 방향을 허용한다.
 *
 * [임시 가정] 분류를 바꿀 때 필드를 옮기는 규칙이 시트에 없다. 새 규칙을 만들지 않고, 일정의
 * '일시'와 할 일의 마감일을 같은 칸(when)으로 본다. 메모로 바꿔도 값은 카드에 남겨 되돌리면
 * 복원되고, 저장 대상에서만 빠진다(toSaveDraft). 일정에 종료 일시가 필요해지면 다시 정한다.
 * [임시 가정] 제목·일시 필드 이름은 DTL-AI-005 추출 항목에 없다(날짜만 있음). AI 응답 형식이
 * 정해지면(계획서 4-2 ②) 변환 함수만 붙인다.
 * [임시 가정] 입력 검사 규칙이 시트에 없다. 제목은 앞뒤 공백을 빼고 비어 있으면 확정하지 않는다.
 * 일시는 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:mm'(달력에 있는 날짜)이고, 비우면 일시 없음으로 본다.
 */

export type Category = 'event' | 'task' | 'memo';
export const CATEGORIES: readonly Category[] = ['event', 'task', 'memo'];

export type EditableField = 'title' | 'when';

export type ResultCard = {
  readonly category: Category;
  readonly title: string;
  /** 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:mm'. 없으면 null */
  readonly when: string | null;
  readonly project: string | null;
  readonly assignee: string | null;
  readonly place: string | null;
  /** 사용자가 바꾼 항목. DTL-UX-006의 'AI 제안 후 사용자 확정' 기록에 쓸 수 있게 남긴다. */
  readonly edited: readonly ('category' | EditableField)[];
  readonly editing: { readonly field: EditableField; readonly text: string; readonly error: EditError | null } | null;
};

export type EditError = 'emptyTitle' | 'invalidWhen';

export function createCard(input: Omit<ResultCard, 'edited' | 'editing'>): ResultCard {
  return { ...input, edited: [], editing: null };
}

function markEdited(card: ResultCard, key: 'category' | EditableField): readonly ('category' | EditableField)[] {
  return card.edited.includes(key) ? card.edited : [...card.edited, key];
}

/** DTL-UX-003: 즉시 바꾼다. 같은 분류를 고르면 아무것도 바꾸지 않는다. */
export function changeCategory(card: ResultCard, next: Category): ResultCard {
  if (card.category === next) return card;
  return { ...card, category: next, edited: markEdited(card, 'category') };
}

/** 저장으로 넘길 값. 메모는 일시를 보내지 않는다. */
export function toSaveDraft(card: ResultCard) {
  const { category, title, when, project, assignee, place } = card;
  return { category, title, when: category === 'memo' ? null : when, project, assignee, place };
}

/** DTL-UX-004: 탭하면 편집을 연다. 다른 칸을 편집 중이면 그 칸은 확정 시도 없이 닫는다. */
export function startEdit(card: ResultCard, field: EditableField): ResultCard {
  if (field === 'when' && card.category === 'memo') return card; // 메모 카드에는 일시 칸이 없다
  return { ...card, editing: { field, text: card[field] ?? '', error: null } };
}

export function updateEditText(card: ResultCard, text: string): ResultCard {
  if (!card.editing) return card;
  return { ...card, editing: { ...card.editing, text, error: null } };
}

export function cancelEdit(card: ResultCard): ResultCard {
  return card.editing ? { ...card, editing: null } : card;
}

/** 확정. 규칙에 맞지 않으면 편집을 연 채 오류를 달아 돌려준다. */
export function commitEdit(card: ResultCard): ResultCard {
  const editing = card.editing;
  if (!editing) return card;
  const text = editing.text.trim();
  if (editing.field === 'title') {
    if (!text) return { ...card, editing: { ...editing, error: 'emptyTitle' } };
    if (text === card.title) return { ...card, editing: null };
    return { ...card, title: text, editing: null, edited: markEdited(card, 'title') };
  }
  const when = text === '' ? null : normalizeWhen(text);
  if (when === undefined) return { ...card, editing: { ...editing, error: 'invalidWhen' } };
  if (when === card.when) return { ...card, editing: null };
  return { ...card, when, editing: null, edited: markEdited(card, 'when') };
}

/** 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:mm'('T' 구분도 받음)을 정규화한다. 틀리면 undefined. */
export function normalizeWhen(text: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(text);
  if (!m) return undefined;
  const [, y, mo, d, h, mi] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  if (h === undefined) return `${y}-${mo}-${d}`;
  if (Number(h) > 23 || Number(mi) > 59) return undefined;
  return `${y}-${mo}-${d} ${h}:${mi}`;
}
