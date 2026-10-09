import test from 'node:test';
import assert from 'node:assert/strict';
import { validPresence, validTwoStageOutput, twoStageSchema } from './local-ai-two-stage-contract.mjs';
test('존재 판별은 엄격한 boolean만 허용', () => {
  for (const hasTask of [true, false]) assert.equal(validPresence({ hasTask }), true);
  for (const value of [null, {}, [], { hasTask: 'false' }, { hasTask: true, extra: 1 }])
    assert.equal(validPresence(value), false);
});
const task = { title: '검토 초안 만들기', assignee: '준호', due: null,
  contentEvidenceIds: ['s1'], assignmentEvidenceIds: ['s2'] };
test('내용과 배정 근거를 분리하고 미정 배정은 빈 근거 허용', () => {
  assert.equal(validTwoStageOutput({ tasks: [task] }, ['s1', 's2']), true);
  assert.equal(validTwoStageOutput({ tasks: [] }, ['s1']), true);
  assert.equal(validTwoStageOutput({ tasks: [{ ...task, assignee: null, assignmentEvidenceIds: [] }] }, ['s1']), true);
  assert.deepEqual(twoStageSchema(['s1']).properties.tasks.items.properties.contentEvidenceIds.items.enum, ['s1']);
});
for (const [name, patch] of Object.entries({
  '내용 근거 누락': { contentEvidenceIds: [] },
  '없는 내용 ID': { contentEvidenceIds: ['s9'] },
  '배정 근거 누락': { assignmentEvidenceIds: [] },
  '없는 배정 ID': { assignmentEvidenceIds: ['s9'] },
  '중복 배정 ID': { assignmentEvidenceIds: ['s2', 's2'] },
  '추가 필드': { extra: true },
})) test(name, () => assert.equal(validTwoStageOutput({ tasks: [{ ...task, ...patch }] }, ['s1', 's2']), false));
