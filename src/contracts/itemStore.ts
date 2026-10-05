/**
 * 일정·할 일·메모 저장소의 약속 — 단계 0 계약. 기능 로직은 이 타입에만 기대고, 실제 API 연결과 가짜
 * 저장소(adapters/fake/memoryItemStore.ts)가 같은 약속을 지킨다. 화면·서버가 없는 동안에도 기능을 끝까지
 * 시험하려고 둔다.
 *
 * 결정과 이유
 * - 다른 사용자의 항목은 'notFound'로 답한다. 'forbidden'으로 답하면 그 ID가 있다는 사실이 새어 나간다.
 * - 고치기는 expectedVersion이 저장된 version과 같을 때만 받는다. 다른 기기가 먼저 고쳤으면
 *   'versionConflict'와 현재 version을 돌려준다. 덮어쓸지는 화면이 사용자에게 묻는다.
 * - 영구 삭제는 휴지통에 있는 항목만 받는다(DTL-SYS-001). 목록에서 바로 파기되는 사고를 막는다.
 * - 휴지통으로 옮기기는 여러 번 불러도 결과가 같다. 두 번 눌린 삭제 버튼이 오류를 내지 않게 한다.
 * - 같은 AI 후보(candidateId)를 다시 저장하면 새로 만들지 않고 이미 저장된 항목을 돌려준다. 분석 재시도나
 *   네트워크 재전송으로 같은 일정이 두 개 생기지 않게 한다.
 * [합의 필요] 실제 HTTP 경로·오류 본문은 API 담당과 맞춘다. 여기 오류 코드는 그 대응표의 기준으로 쓴다.
 */
import type { ContentProblem, Item, ItemContent, ItemKind } from './items.ts';

export type StoreError =
  | { readonly code: 'notFound' }
  | { readonly code: 'invalidContent'; readonly problems: readonly ContentProblem[] }
  | { readonly code: 'versionConflict'; readonly currentVersion: number }
  /** 저장된 항목의 종류(일정/할 일/메모)는 고치기로 바꾸지 않는다. 종류 바꾸기는 저장 전 카드에서 한다. */
  | { readonly code: 'kindMismatch' }
  /** 휴지통 항목은 복원한 뒤에 고친다. */
  | { readonly code: 'inTrash' }
  | { readonly code: 'notInTrash' }
  | { readonly code: 'restoreExpired' };

export type StoreResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: StoreError };

export type ItemStore = {
  create(ownerId: string, content: ItemContent): Promise<StoreResult<Item>>;
  /** 휴지통에 있는 항목도 돌려준다(deletedAt으로 구분). 근거 원본이 휴지통에 있는지 알려면 필요하다. */
  get(ownerId: string, id: string): Promise<StoreResult<Item>>;
  /** 휴지통에 없는 항목만, 만든 순서로. 기능별 정렬(시각순 등)은 각 기능이 한다. */
  list(ownerId: string, kind?: ItemKind): Promise<readonly Item[]>;
  update(ownerId: string, id: string, expectedVersion: number, content: ItemContent): Promise<StoreResult<Item>>;
  moveToTrash(ownerId: string, id: string): Promise<StoreResult<Item>>;
  restore(ownerId: string, id: string): Promise<StoreResult<Item>>;
  purge(ownerId: string, id: string): Promise<StoreResult<null>>;
  /** 아직 복원할 수 있는(보관 기간 안의) 휴지통 항목만. */
  listTrash(ownerId: string): Promise<readonly Item[]>;
};
