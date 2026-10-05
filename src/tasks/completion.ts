/**
 * 할 일 완료 — DTL-TSK-002(상위 REQ-TSK-002).
 * 원문: 할 일 항목 좌측의 원형 체크박스를 탭하면 체크 애니메이션과 함께 취소선이 그어지며 '완료' 상태로 변경된다.
 * 애니메이션·취소선은 화면 몫이고, 여기서는 상태 바꾸기와 저장만 한다.
 *
 * 결정과 이유
 * - 완료는 completedAt(완료 시각)으로 둔다(contracts/items.ts). 참/거짓만 두면 '오늘 끝낸 일' 같은 집계를 못 한다.
 * - 저장은 읽었을 때의 version을 실어 보낸다. 다른 기기가 먼저 고쳤으면 versionConflict가 그대로 돌아오고, 다시 읽어
 *   누를지는 화면이 정한다(contracts/itemStore.ts).
 * - 저장이 끝나기 전에 같은 할 일을 또 누르면 무시한다. 두 요청이 같은 version으로 가서 뒤의 것이 충돌로 실패하고,
 *   화면에는 체크가 두 번 뒤집혀 보이기 때문이다.
 * - 출처(provenance)는 바꾸지 않는다. 자동 저장된 AI 할 일을 완료해도 'AI 생성' 배지는 그대로다(OD-17).
 * - [임시 가정] 완료한 할 일을 다시 누르면 완료를 푼다. 원문은 완료만 적었지만, 잘못 누른 것을 되돌릴 길이 없으면
 *   할 일을 다시 만들어야 한다(docs/open-decisions.md OD-16).
 * - [임시 가정] 완료 시각은 누른 기기의 시계(now)로 넣는다. 서버 시각으로 바꿀지는 API 담당과 정한다(OD-16).
 */
import { contentOf, type Item, type TaskContent, type TaskItem } from '../contracts/items.ts';
import type { ItemStore, StoreResult } from '../contracts/itemStore.ts';
import type { Instant } from '../contracts/time.ts';

/** 완료 여부만 바꾼 새 내용. 원래 값은 바꾸지 않는다. */
export function withCompletion(task: TaskContent, completed: boolean, now: Instant): TaskContent {
  if (completed === (task.completedAt !== null)) return task; // 이미 그 상태면 완료 시각도 그대로 둔다
  return { ...task, completedAt: completed ? now : null };
}

export type ToggleResult = StoreResult<Item> | { readonly ok: false; readonly error: { readonly code: 'pending' } };

export type ToggleDeps = {
  readonly store: ItemStore;
  readonly ownerId: string;
  readonly now: () => Instant;
};

/** 체크박스 처리기를 만든다. 넘긴 할 일이 완료 상태면 풀고, 아니면 완료한다. */
export function createCompletionToggle(deps: ToggleDeps): (task: TaskItem) => Promise<ToggleResult> {
  const pending = new Set<string>();
  return async (task) => {
    if (pending.has(task.id)) return { ok: false, error: { code: 'pending' } };
    pending.add(task.id);
    try {
      const next = withCompletion(contentOf(task), task.completedAt === null, deps.now());
      return await deps.store.update(deps.ownerId, task.id, task.version, next);
    } finally {
      pending.delete(task.id);
    }
  };
}
