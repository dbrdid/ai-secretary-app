import test from 'node:test';
import assert from 'node:assert/strict';
import { validOutput, schemaFor } from './local-ai-contract.mjs';
const task = { title: '검토 화면 초안 만들기', assignee: '준호', due: '2026-10-09', evidenceIds: ['s1'] };
test('정상 결과와 할 일 없는 결과', () => {
  assert.equal(validOutput({ tasks: [task] }, ['s1']), true);
  assert.equal(validOutput({ tasks: [] }, ['s1']), true);
  assert.deepEqual(schemaFor(['s1']).properties.tasks.items.properties.evidenceIds.items.enum, ['s1']);
});
for (const [name, output] of Object.entries({
  '빈 객체': {}, '필드 누락': { tasks: [{ title: '초안' }] },
  '알 수 없는 근거': { tasks: [{ ...task, evidenceIds: ['s9'] }] },
  '중복 근거': { tasks: [{ ...task, evidenceIds: ['s1', 's1'] }] },
  '빈 근거': { tasks: [{ ...task, evidenceIds: [] }] },
  '기본 제목': { tasks: [{ ...task, title: '할 일' }] },
  '공백 제목': { tasks: [{ ...task, title: ' ' }] },
  '잘못된 날짜 형식': { tasks: [{ ...task, due: '내일' }] },
  '추가 필드': { tasks: [{ ...task, invented: true }] },
  '빈 담당자': { tasks: [{ ...task, assignee: '' }] },
  'null 결과': null,
})) test(name + ' 거부', () => assert.equal(validOutput(output, ['s1']), false));
