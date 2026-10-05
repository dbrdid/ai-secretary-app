/**
 * 메모리 안에서 도는 가짜 저장소 — contracts/itemStore.ts의 약속을 지킨다. 화면·서버가 없는 동안 기능
 * 로직과 테스트가 이것으로 저장·조회·휴지통 흐름을 끝까지 돌린다.
 *
 * - 시각과 ID는 주입받는다. 테스트가 30일 경계처럼 정확한 시각을 만들어야 해서다.
 * - 넣고 꺼낼 때 복사한다. 실제 API는 JSON으로 오가므로 호출한 쪽이 받은 객체를 고쳐도 저장값이 바뀌지
 *   않는다. 가짜도 그렇게 해야 실제 연결 때 드러날 버그를 미리 잡는다.
 * - 이 가짜의 통과는 실제 서버 저장·권한 검증 완료가 아니다.
 */
import { checkContent, type Item, type ItemContent } from '../../contracts/items.ts';
import type { ItemStore, StoreError, StoreResult } from '../../contracts/itemStore.ts';
import type { Instant } from '../../contracts/time.ts';
import { isRestorable, TRASH_RETENTION_DAYS } from '../../contracts/trash.ts';

export type MemoryItemStoreOptions = {
  readonly now: () => Instant;
  readonly newId: () => string;
  /** 기본값은 DTL-SYS-001의 30일 */
  readonly retentionDays?: number;
};

export type MemoryItemStore = ItemStore & {
  /** 서버 예약 작업 흉내: 보관 기간이 지난 휴지통 항목을 파기하고 파기한 개수를 돌려준다. */
  purgeExpired(): Promise<number>;
};

const ok = <T>(value: T): StoreResult<T> => ({ ok: true, value });
const fail = (error: StoreError): StoreResult<never> => ({ ok: false, error });
const copy = <T>(value: T): T => structuredClone(value);

function withMeta(content: ItemContent, meta: Pick<Item, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>): Item {
  return { ...copy(content), ...meta };
}

export function createMemoryItemStore(options: MemoryItemStoreOptions): MemoryItemStore {
  const retentionDays = options.retentionDays ?? TRASH_RETENTION_DAYS;
  // Map은 넣은 순서를 지키고, 같은 키로 다시 넣어도 자리가 바뀌지 않는다 → 목록이 '만든 순서'가 된다.
  const items = new Map<string, Item>();

  const find = (ownerId: string, id: string): Item | undefined => {
    const item = items.get(id);
    return item !== undefined && item.ownerId === ownerId ? item : undefined;
  };

  const put = (item: Item): StoreResult<Item> => {
    items.set(item.id, item);
    return ok(copy(item));
  };

  const restorableAt = (item: Item, now: Instant): boolean =>
    item.deletedAt !== null && isRestorable(item.deletedAt, now, retentionDays);

  return {
    async create(ownerId, content) {
      const problems = checkContent(content);
      if (problems.length > 0) return fail({ code: 'invalidContent', problems });
      const p = content.provenance;
      if (p.origin === 'ai') {
        for (const item of items.values()) {
          const q = item.provenance;
          if (item.ownerId === ownerId && q.origin === 'ai' && q.candidateId === p.candidateId) return ok(copy(item));
        }
      }
      const now = options.now();
      return put(withMeta(content, { id: options.newId(), ownerId, createdAt: now, updatedAt: now, deletedAt: null, version: 1 }));
    },

    async get(ownerId, id) {
      const item = find(ownerId, id);
      return item === undefined ? fail({ code: 'notFound' }) : ok(copy(item));
    },

    async list(ownerId, kind) {
      return [...items.values()]
        .filter((i) => i.ownerId === ownerId && i.deletedAt === null && (kind === undefined || i.kind === kind))
        .map((i) => copy(i));
    },

    async update(ownerId, id, expectedVersion, content) {
      const current = find(ownerId, id);
      if (current === undefined) return fail({ code: 'notFound' });
      if (current.deletedAt !== null) return fail({ code: 'inTrash' });
      if (current.version !== expectedVersion) return fail({ code: 'versionConflict', currentVersion: current.version });
      if (current.kind !== content.kind) return fail({ code: 'kindMismatch' });
      const problems = checkContent(content);
      if (problems.length > 0) return fail({ code: 'invalidContent', problems });
      return put(
        withMeta(content, {
          id,
          ownerId,
          createdAt: current.createdAt,
          updatedAt: options.now(),
          deletedAt: null,
          version: current.version + 1,
        }),
      );
    },

    async moveToTrash(ownerId, id) {
      const current = find(ownerId, id);
      if (current === undefined) return fail({ code: 'notFound' });
      if (current.deletedAt !== null) return ok(copy(current)); // 이미 휴지통: 같은 결과
      const now = options.now();
      return put({ ...current, deletedAt: now, updatedAt: now, version: current.version + 1 });
    },

    async restore(ownerId, id) {
      const current = find(ownerId, id);
      if (current === undefined) return fail({ code: 'notFound' });
      if (current.deletedAt === null) return fail({ code: 'notInTrash' });
      const now = options.now();
      if (!restorableAt(current, now)) return fail({ code: 'restoreExpired' });
      return put({ ...current, deletedAt: null, updatedAt: now, version: current.version + 1 });
    },

    async purge(ownerId, id) {
      const current = find(ownerId, id);
      if (current === undefined) return fail({ code: 'notFound' });
      if (current.deletedAt === null) return fail({ code: 'notInTrash' });
      items.delete(id);
      return ok(null);
    },

    async listTrash(ownerId) {
      const now = options.now();
      return [...items.values()].filter((i) => i.ownerId === ownerId && restorableAt(i, now)).map((i) => copy(i));
    },

    async purgeExpired() {
      const now = options.now();
      let purged = 0;
      for (const [id, item] of items) {
        if (item.deletedAt !== null && !restorableAt(item, now)) {
          items.delete(id);
          purged += 1;
        }
      }
      return purged;
    },
  };
}
