import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContent } from '../contracts/items.ts';
import { MEMO_MESSAGES, clampMemoInput, isEmptyMemo, isRecordingTooShort, memoLength } from './memoInput.ts';

describe('DTL-INB-003 메모 길이 제한', () => {
  test('10,000자까지 받고 넘으면 잘라서 경고한다', () => {
    const ok = '가'.repeat(10_000);
    assert.deepEqual(clampMemoInput(ok), { text: ok, warning: null });
    const over = clampMemoInput('가'.repeat(10_005));
    assert.equal(memoLength(over.text), 10_000);
    assert.equal(over.warning, '더 이상 입력할 수 없습니다');
  });

  test('이모지는 1자로 세고 자를 때 반으로 가르지 않는다', () => {
    assert.equal(memoLength('😀'), 1);
    const r = clampMemoInput('ab😀😀', 3);
    assert.equal(r.text, 'ab😀');
    assert.equal(r.warning, MEMO_MESSAGES.tooLong);
  });
});

describe('REQ-INB-016 빈 메모 저장 방지', () => {
  test('공백만 있으면 빈 메모다', () => {
    assert.equal(isEmptyMemo('  \n\t '), true);
    assert.equal(isEmptyMemo(' 회의 '), false);
  });

  test('저장소의 검사(checkContent)와 같은 기준이다', () => {
    for (const body of ['', '   ', '\n', '메모']) {
      const problems = checkContent({ kind: 'memo', body, provenance: { origin: 'manual' }, projectId: null, tags: [] });
      assert.equal(problems.includes('emptyBody'), isEmptyMemo(body), JSON.stringify(body));
    }
  });
});

describe('DTL-INB-006 너무 짧은 녹음', () => {
  test('3초 미만이면 버린다', () => {
    assert.equal(isRecordingTooShort(2_999), true);
    assert.equal(isRecordingTooShort(3_000), false);
  });
});
