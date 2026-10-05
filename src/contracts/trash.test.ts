import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isRestorable, purgeDueAt } from './trash.ts';

const deletedAt = '2026-09-28T03:00:00.000Z';

describe('DTL-SYS-001 휴지통 30일', () => {
  test('옮긴 순간부터 30×24시간 뒤가 파기 시각이다', () => {
    assert.equal(purgeDueAt(deletedAt), '2026-10-28T03:00:00.000Z');
  });

  test('경계: 만료 1ms 전까지 복원, 만료 정각부터는 복원 불가', () => {
    assert.equal(isRestorable(deletedAt, '2026-10-28T02:59:59.999Z'), true);
    assert.equal(isRestorable(deletedAt, '2026-10-28T03:00:00.000Z'), false);
  });

  test('보관 기간은 확정 전이라 바꿔 넣을 수 있다', () => {
    assert.equal(purgeDueAt(deletedAt, 7), '2026-10-05T03:00:00.000Z');
    assert.equal(isRestorable(deletedAt, '2026-10-05T03:00:00.000Z', 7), false);
  });
});
