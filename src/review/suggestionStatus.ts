/**
 * AI 제안의 상태 흐름 — REQ-UX-011(제안 상태 흐름), REQ-UX-007(거절), REQ-UX-008(나중에 확인), REQ-UX-009(한 번에 처리),
 * REQ-UX-001·BRF-005(확인 대기 개수).
 * 원문
 * - REQ-UX-011: 각 제안을 '확인 대기 → 승인 / 거절 / 보류' 상태로 관리하고, 사용자는 지금 상태를 확인할 수 있다.
 * - REQ-UX-007: 거절된 제안은 할 일·일정으로 등록되지 않는다.
 * - REQ-UX-008: 바로 판단하기 어려운 제안을 보류해 두고 나중에 다시 확인할 수 있다.
 * - REQ-UX-009: 여러 제안을 선택해 한 번에 승인하거나 거절할 수 있다.
 *
 * 결정과 이유
 * - 승인·거절은 끝 상태다. 승인한 제안은 일정·할 일로 저장되고(REQ-UX-006), 그 뒤 고치거나 지우는 것은 저장된 항목에서
 *   한다. 거절을 되돌리는 것은 원문에 없다.
 * - 보류한 제안은 나중에 승인·거절할 수 있다. 다시 '확인 대기'로 돌리는 것도 받는다(보류를 푼다).
 * - 상태 이름 'pending'의 화면 표시는 '확인 대기'다(명세서 v5 용어, REQ-UX-001).
 * - 한 번에 처리할 때 일부가 받을 수 없는 상태(이미 승인됨 등)이면 그것만 건너뛰고 나머지는 처리한다. 건너뛴 것은 결과에
 *   담아 화면이 알릴 수 있게 한다. 하나 때문에 전체를 실패시키면 다른 기기에서 먼저 처리한 제안 하나로 일괄 처리가 막힌다.
 * - [해석] 홈의 '확인 대기' 개수(REQ-UX-001)에는 보류도 넣는다. 보류도 아직 확인하지 않은 제안이고, 빼면 보류한 제안을
 *   잊기 쉽다. 두 수를 따로도 돌려줘 화면이 고를 수 있게 한다.
 * - 실제 저장(승인 → 일정·할 일 생성)은 review/resultCard.ts의 toSaveDraft와 저장소가 한다. 여기서는 상태만 다룬다.
 */

export const SUGGESTION_STATUSES = ['pending', 'approved', 'rejected', 'deferred'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const SUGGESTION_STATUS_LABELS: Readonly<Record<SuggestionStatus, string>> = {
  pending: '확인 대기',
  approved: '승인',
  rejected: '거절',
  deferred: '보류',
};

export type SuggestionAction = 'approve' | 'reject' | 'defer' | 'reopen';

const NEXT: Readonly<Record<SuggestionStatus, Partial<Record<SuggestionAction, SuggestionStatus>>>> = {
  pending: { approve: 'approved', reject: 'rejected', defer: 'deferred' },
  deferred: { approve: 'approved', reject: 'rejected', reopen: 'pending' },
  approved: {},
  rejected: {},
};

/** 받을 수 없는 동작이면 null. */
export function nextStatus(current: SuggestionStatus, action: SuggestionAction): SuggestionStatus | null {
  return NEXT[current][action] ?? null;
}

/** REQ-UX-007: 일정·할 일로 등록되는 것은 승인한 제안뿐이다. */
export function becomesItem(status: SuggestionStatus): boolean {
  return status === 'approved';
}

export type Suggestion = { readonly id: string; readonly status: SuggestionStatus };

export type BatchResult<S extends Suggestion> = {
  readonly suggestions: readonly S[];
  /** 상태가 바뀐 제안의 id */
  readonly changed: readonly string[];
  /** 지금 상태에서 받을 수 없어 건너뛴 제안의 id */
  readonly skipped: readonly string[];
};

/** REQ-UX-009: 고른 제안에 같은 동작을 한 번에 적용한다. 고르지 않은 제안은 그대로 둔다. */
export function applyToSelected<S extends Suggestion>(suggestions: readonly S[], selectedIds: readonly string[], action: SuggestionAction): BatchResult<S> {
  const selected = new Set(selectedIds);
  const changed: string[] = [];
  const skipped: string[] = [];
  const next = suggestions.map((s) => {
    if (!selected.has(s.id)) return s;
    const status = nextStatus(s.status, action);
    if (status === null) {
      skipped.push(s.id);
      return s;
    }
    changed.push(s.id);
    return { ...s, status };
  });
  return { suggestions: next, changed, skipped };
}

/** REQ-UX-001·BRF-005: 아직 확인하지 않은 제안 수. total은 확인 대기 + 보류. */
export function unconfirmedCounts(suggestions: readonly Suggestion[]): { readonly pending: number; readonly deferred: number; readonly total: number } {
  let pending = 0;
  let deferred = 0;
  for (const s of suggestions) {
    if (s.status === 'pending') pending += 1;
    else if (s.status === 'deferred') deferred += 1;
  }
  return { pending, deferred, total: pending + deferred };
}
