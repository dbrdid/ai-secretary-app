import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { cases } from './local-ai-regression-cases.mjs';
import { classifiedCases } from './local-ai-classified-cases.mjs';
import { validClassification, classificationSchema, evaluateClassified, maximumMatching } from './local-ai-classified-contract.mjs';
const multi = classifiedCases.find(c => c.id === 'multi_independent');
function fixture(item = multi) {
  const segments = item.text.split('\n').map((text, i) => ({ id: 's' + (i + 1), text }));
  const classification = { utterances: item.expectedLabels.map((labels, i) => ({ id: 's' + (i + 1), labels: [...labels] })) };
  const output = { tasks: item.expectedTasks.map(e => ({ title: e.titleTerms.join(' ') + ' 수행', assignee: e.assignee, due: e.due,
    contentEvidenceIds: [...e.contentRequired], assignmentEvidenceIds: [...e.assignmentRequired] })) };
  return { segments, classification, output };
}
const evaluate = f => evaluateClassified(multi, f.classification, f.output, f.segments);
test('기존 10개 입력/기대값은 기준 실행기와 동일', () => {
  const baseline = structuredClone(cases);
  const source = readFileSync(new URL('./verify-local-ai-two-stage.mjs', import.meta.url), 'utf8');
  runInNewContext(source.slice(source.indexOf('cases.push('), source.indexOf('async function generate')), { cases: baseline });
  assert.equal(baseline.length, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(classifiedCases.slice(0, 10).map(({id,text,expected}) => ({id,text,expected})))), JSON.parse(JSON.stringify(baseline)));
});
test('전체 고정 기대값 자체의 검사 일관성', () => {
  for (const item of classifiedCases) { const f = fixture(item); assert.equal(evaluateClassified(item, f.classification, f.output, f.segments).pass, true, item.id); }
});
test('업무와 발화 결과 순서 무관', () => { const f = fixture(); f.output.tasks.reverse(); f.classification.utterances.reverse(); assert.equal(evaluate(f).pass, true); });
test('최대 대응은 탐욕 매칭의 충돌을 해결', () => assert.equal(maximumMatching([[0,1],[0]], 2).length, 2));
for (const [name, mutate] of Object.entries({
  '업무 누락': f => f.output.tasks.pop(),
  '업무 중복': f => f.output.tasks.push(structuredClone(f.output.tasks[0])),
  '같은 수의 중복으로 누락 은폐': f => f.output.tasks[1] = structuredClone(f.output.tasks[0]),
  '담당자 오연결': f => { [f.output.tasks[0].assignee, f.output.tasks[1].assignee] = [f.output.tasks[1].assignee, f.output.tasks[0].assignee]; },
  '기한 오연결': f => { [f.output.tasks[0].due, f.output.tasks[1].due] = [f.output.tasks[1].due, f.output.tasks[0].due]; },
  '내용 근거 오연결': f => f.output.tasks[0].contentEvidenceIds = ['s2'],
  '배정 근거 오연결': f => f.output.tasks[0].assignmentEvidenceIds = ['s2'],
  '전체 근거를 모두 붙여 오연결 은폐': f => f.output.tasks.forEach(t => { t.contentEvidenceIds = ['s1','s2']; t.assignmentEvidenceIds = ['s1','s2']; }),
  '두 업무 제목 합침': f => f.output.tasks.forEach(t => { t.title = '검토 초안 저장 검증'; }),
  '무관 제목': f => f.output.tasks[0].title = '기타 업무',
  '알 수 없는 ID': f => f.output.tasks[0].contentEvidenceIds = ['s9'],
  '빈 객체': f => f.output = {},
  '분류 누락': f => f.classification.utterances.pop(),
  '분류 중복 ID': f => f.classification.utterances[1].id = 's1',
  '잘못된 분류 의미': f => f.classification.utterances[0].labels = ['refusal'],
})) test(name + ' 검출', () => { const f = fixture(); mutate(f); assert.equal(evaluate(f).pass, false); });
test('한 발화의 복수 업무도 담당자/기한 교환 검출', () => {
  const item = classifiedCases.find(c => c.id === 'same_utterance_two_tasks'), f = fixture(item);
  [f.output.tasks[0].assignee, f.output.tasks[1].assignee] = [f.output.tasks[1].assignee, f.output.tasks[0].assignee];
  assert.equal(evaluateClassified(item, f.classification, f.output, f.segments).checks.taskBijection, false);
});
test('배정 변경에서 예전 담당자/기한 검출', () => {
  const item = classifiedCases.find(c => c.id === 'reversal'), f = fixture(item);
  f.output.tasks[0].assignee = '준호'; f.output.tasks[0].due = '2026-10-09';
  assert.equal(evaluateClassified(item, f.classification, f.output, f.segments).pass, false);
});
test('분류 실패가 업무 비교를 게이트하지 않음', () => { const f = fixture(); f.classification = null; const r = evaluate(f); assert.equal(r.checks.taskBijection, true); assert.equal(r.pass, false); });
test('분류 계약 다중 라벨/추가키/중복/unknown/other 혼합', () => {
  const value = labels => ({utterances:[{id:'s1',labels}]});
  assert.equal(validClassification(value(['refusal','necessity']), ['s1']), true);
  for (const v of [null, {}, value([]), value(['refusal','refusal']), value(['unknown']), value(['other','necessity']), {...value(['other']),extra:1}]) assert.equal(validClassification(v,['s1']), false);
  assert.equal(classificationSchema(['s1']).properties.utterances.minItems, 1);
});
test('거절/업무 취소 뒤 잔여 업무 오검출', () => {
  for (const id of ['negated_self', 'pure_refusal', 'cancelled_task']) {
    const item = classifiedCases.find(c => c.id === id), f = fixture(item);
    f.output.tasks.push({title:'검토 화면 초안 만들기',assignee:null,due:null,contentEvidenceIds:['s1'],assignmentEvidenceIds:[]});
    assert.equal(evaluateClassified(item,f.classification,f.output,f.segments).checks.count,false,id);
  }
});
test('거절 후 필요성 업무를 전체 boolean처럼 버리면 실패', () => {
  const item = classifiedCases.find(c => c.id === 'required_after_refusal'), f = fixture(item); f.output.tasks = [];
  assert.equal(evaluateClassified(item,f.classification,f.output,f.segments).checks.taskBijection,false);
});
test('필요성 발언자를 담당자로 만드는 오류', () => {
  const item = classifiedCases.find(c => c.id === 'observation_only'), f = fixture(item); f.output.tasks[0].assignee = '준호';
  assert.equal(evaluateClassified(item,f.classification,f.output,f.segments).taskChecks[0][0].assignee,false);
});
test('명시된 미정 근거 누락은 schema 통과해도 의미 검사 실패', () => {
  const item = classifiedCases.find(c => c.id === 'missing'), f = fixture(item); f.output.tasks[0].assignmentEvidenceIds = [];
  const r = evaluateClassified(item,f.classification,f.output,f.segments); assert.equal(r.checks.schemaValid,true); assert.equal(r.checks.taskBijection,false);
});

import { parseClassifiedOptions } from './verify-local-ai-classified.mjs';
test('독립 실행기 선택/시간 제한은 명시적이며 잘못된 옵션으로 AI를 실행하지 않음', () => {
  assert.deepEqual(parseClassifiedOptions([]), {additionalOnly:false,timeoutMs:45000});
  assert.deepEqual(parseClassifiedOptions(['--additional-only','--timeout-ms=90000']), {additionalOnly:true,timeoutMs:90000});
  assert.throws(() => parseClassifiedOptions(['--timeout-ms=0']));
  assert.throws(() => parseClassifiedOptions(['--help']));
});
