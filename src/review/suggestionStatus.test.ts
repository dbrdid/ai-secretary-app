import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SUGGESTION_STATUS_LABELS, applyToSelected, becomesItem, nextStatus, unconfirmedCounts, type Suggestion } from './suggestionStatus.ts';

describe('REQ-UX-011 제안 상태 흐름', () => {
  test('확인 대기에서 승인·거절·보류로 간다', () => {
    assert.equal(nextStatus('pending', 'approve'), 'approved');
    assert.equal(nextStatus('pending', 'reject'), 'rejected');
    assert.equal(nextStatus('pending', 'defer'), 'deferred');
  });

  test('보류한 제안은 나중에 승인·거절하거나 확인 대기로 되돌릴 수 있다(REQ-UX-008)', () => {
    assert.equal(nextStatus('deferred', 'approve'), 'approved');
    assert.equal(nextStatus('deferred', 'reject'), 'rejected');
    assert.equal(nextStatus('deferred', 'reopen'), 'pending');
  });

  test('승인·거절은 끝 상태다', () => {
    for (const action of ['approve', 'reject', 'defer', 'reopen'] as const) {
      assert.equal(nextStatus('approved', action), null);
      assert.equal(nextStatus('rejected', action), null);
    }
  });

  test('거절한 제안은 일정·할 일이 되지 않는다(REQ-UX-007)', () => {
    assert.equal(becomesItem('approved'), true);
    assert.equal(becomesItem('rejected'), false);
    assert.equal(becomesItem('deferred'), false);
  });

  test("화면 표시는 '확인 대기'다", () => {
    assert.equal(SUGGESTION_STATUS_LABELS.pending, '확인 대기');
  });
});

describe('REQ-UX-009 여러 제안 한 번에 처리', () => {
  const list: Suggestion[] = [
    { id: 'a', status: 'pending' },
    { id: 'b', status: 'deferred' },
    { id: 'c', status: 'approved' },
    { id: 'd', status: 'pending' },
  ];

  test('고른 것만 바꾸고, 받을 수 없는 것은 건너뛰고 알린다', () => {
    const r = applyToSelected(list, ['a', 'b', 'c'], 'reject');
    assert.deepEqual(r.suggestions.map((s) => s.status), ['rejected', 'rejected', 'approved', 'pending']);
    assert.deepEqual(r.changed, ['a', 'b']);
    assert.deepEqual(r.skipped, ['c']);
  });

  test('원래 목록은 바꾸지 않는다', () => {
    applyToSelected(list, ['a'], 'approve');
    assert.equal(list[0]?.status, 'pending');
  });
});

describe('REQ-UX-001 확인 대기 개수', () => {
  test('확인 대기와 보류를 따로, 합계도 센다', () => {
    const counts = unconfirmedCounts([
      { id: '1', status: 'pending' },
      { id: '2', status: 'pending' },
      { id: '3', status: 'deferred' },
      { id: '4', status: 'approved' },
      { id: '5', status: 'rejected' },
    ]);
    assert.deepEqual(counts, { pending: 2, deferred: 1, total: 3 });
  });
});
