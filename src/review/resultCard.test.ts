import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  cancelEdit,
  changeCategory,
  commitEdit,
  createCard,
  normalizeWhen,
  startEdit,
  toSaveDraft,
  updateEditText,
} from './resultCard.ts';

// 문서 C의 예시 메모 "금요일까지 발표 자료 완성"을 AI가 일정으로 제안했다고 둔다.
const aiEvent = () =>
  createCard({ category: 'event', title: '발표 자료 완성', when: '2026-10-02', project: null, assignee: null, place: null });

describe('DTL-UX-003 분류 바꾸기', () => {
  test("AI가 '일정'으로 제안한 건을 '할 일'이나 '메모'로 즉시 바꾼다", () => {
    assert.equal(changeCategory(aiEvent(), 'task').category, 'task');
    assert.equal(changeCategory(aiEvent(), 'memo').category, 'memo');
  });

  test('REQ-UX-003: 모든 방향으로 바꿀 수 있다', () => {
    for (const from of CATEGORIES) {
      for (const to of CATEGORIES) {
        const card = changeCategory(changeCategory(aiEvent(), from), to);
        assert.equal(card.category, to, `${from} → ${to}`);
      }
    }
  });

  test('같은 분류를 고르면 바뀐 것으로 치지 않는다', () => {
    const card = aiEvent();
    assert.equal(changeCategory(card, 'event'), card);
    assert.deepEqual(card.edited, []);
  });

  test('[임시 가정] 일정 → 할 일: 일시가 그대로 마감일이 된다', () => {
    assert.equal(toSaveDraft(changeCategory(aiEvent(), 'task')).when, '2026-10-02');
  });

  test('[임시 가정] 메모로 바꾸면 일시는 저장에서 빠지지만, 되돌리면 복원된다', () => {
    const memo = changeCategory(aiEvent(), 'memo');
    assert.equal(toSaveDraft(memo).when, null);
    const back = changeCategory(memo, 'event');
    assert.equal(toSaveDraft(back).when, '2026-10-02');
    assert.deepEqual(back.edited, ['category']);
  });
});

describe('DTL-UX-004 제목·날짜 인라인 수정', () => {
  test('제목을 탭해 고치고 확정하면 반영되고 수정 표시가 남는다', () => {
    let card = startEdit(aiEvent(), 'title');
    assert.deepEqual(card.editing, { field: 'title', text: '발표 자료 완성', error: null });
    card = commitEdit(updateEditText(card, '  발표 자료 최종본  '));
    assert.equal(card.title, '발표 자료 최종본');
    assert.equal(card.editing, null);
    assert.deepEqual(card.edited, ['title']);
  });

  test('취소하면 원래 값이 남는다', () => {
    const card = cancelEdit(updateEditText(startEdit(aiEvent(), 'title'), '다른 제목'));
    assert.equal(card.title, '발표 자료 완성');
    assert.equal(card.editing, null);
    assert.deepEqual(card.edited, []);
  });

  test('[임시 가정] 빈 제목은 확정하지 않고 오류를 단 채 편집을 유지한다', () => {
    const card = commitEdit(updateEditText(startEdit(aiEvent(), 'title'), '   '));
    assert.equal(card.title, '발표 자료 완성');
    assert.equal(card.editing?.error, 'emptyTitle');
    assert.equal(updateEditText(card, '새 제목').editing?.error, null);
  });

  test('날짜를 고치면 정규화해서 반영한다(시각 포함 가능)', () => {
    const card = commitEdit(updateEditText(startEdit(aiEvent(), 'when'), '2026-10-01T14:30'));
    assert.equal(card.when, '2026-10-01 14:30');
    assert.deepEqual(card.edited, ['when']);
  });

  test('[임시 가정] 틀린 날짜는 확정하지 않는다', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '10/02', '2026-10-02 24:00', '2026-10-02 12:60']) {
      const card = commitEdit(updateEditText(startEdit(aiEvent(), 'when'), bad));
      assert.equal(card.editing?.error, 'invalidWhen', bad);
      assert.equal(card.when, '2026-10-02');
    }
  });

  test('[임시 가정] 날짜를 비우면 일시 없음이 된다', () => {
    assert.equal(commitEdit(updateEditText(startEdit(aiEvent(), 'when'), '')).when, null);
  });

  test('값이 같으면 수정으로 치지 않는다', () => {
    const card = commitEdit(startEdit(aiEvent(), 'when'));
    assert.deepEqual(card.edited, []);
    assert.equal(card.editing, null);
  });

  test('메모 카드에는 일시 칸이 없어 편집을 열지 않는다', () => {
    const memo = changeCategory(aiEvent(), 'memo');
    assert.equal(startEdit(memo, 'when').editing, null);
  });

  test('윤년 2월 29일은 받고 평년은 거절한다', () => {
    assert.equal(normalizeWhen('2028-02-29'), '2028-02-29');
    assert.equal(normalizeWhen('2027-02-29'), undefined);
  });
});
