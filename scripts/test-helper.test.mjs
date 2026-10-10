import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, summarize, applySTTReport } from './test-helper.mjs';
const sttReport = () => ({ complete: true, results: ['assignment', 'negation', 'reversal', 'necessity', 'silence'].map(id => ({ id, status: 'passed' })) });
test('STT 전체 사례 완료만 통과', () => assert.equal(applySTTReport({status:'passed'}, sttReport()).status, 'passed'));
test('STT 불완전 보고서는 오류', () => assert.equal(applySTTReport({status:'passed'}, {...sttReport(), complete:false}).status, 'error'));
test('STT 누락·중복 사례는 오류', () => {
  const report = sttReport(); report.results[4] = report.results[0];
  assert.equal(applySTTReport({status:'passed'}, report).status, 'error');
});
test('STT 품질 실패를 보존', () => {
  const report = sttReport(); report.results[0].status = 'failed';
  assert.equal(applySTTReport({status:'passed'}, report).status, 'failed');
});
test('STT 실행 오류를 보존', () => {
  const report = sttReport(); report.results[0].status = 'error';
  assert.equal(applySTTReport({status:'passed'}, report).status, 'error');
  assert.equal(applySTTReport({status:'error'}, sttReport()).status, 'error');
});
test('성공 종료만 통과', () => assert.equal(classify({status: 0}), 'passed'));
test('실패 종료 보존', () => assert.equal(classify({status: 1}), 'failed'));
test('실행 불가를 성공으로 처리하지 않음', () => assert.equal(classify({status: null, error: new Error('missing')}), 'error'));
test('시간 초과·시그널 구별', () => assert.equal(classify({status: null, signal: 'SIGTERM'}), 'error'));
test('미실행을 통과 합계에서 제외', () => assert.deepEqual(summarize([{status:'passed'},{status:'failed'},{status:'error'},{status:'not_run'}]), {passed:1,failed:1,error:1,not_run:1}));

import { applyClassifiedReport, parseHelperOptions } from './test-helper.mjs';
import { classifiedCases } from './local-ai-classified-cases.mjs';
const aiReport = () => ({ complete: true, results: classifiedCases.map(c => ({ id: c.id, pass: true,
  checks: { classificationValid: true, utteranceLabels: true, schemaValid: true, count: true, taskBijection: true, generationComplete: true } })) });
test('기존 옵션과 별도 AI 옵션을 독립 보존', () => {
  assert.deepEqual(parseHelperOptions([]), [false,false,false]);
  assert.deepEqual(parseHelperOptions(['--ai','--stt']), [true,true,false]);
  assert.deepEqual(parseHelperOptions(['--ai-classified']), [false,false,true]);
  assert.throws(() => parseHelperOptions(['--unknown']));
});
test('classified AI 완전한 보고서만 통과', () => assert.equal(applyClassifiedReport({status:'passed'},aiReport()).status,'passed'));
test('classified AI 누락/중복/불완전 보고서 거부', () => {
  for (const change of [r => r.results.pop(), r => r.results[1] = r.results[0], r => r.complete = false, r => r.results[0].checks = {}]) {
    const r = aiReport(); change(r); assert.equal(applyClassifiedReport({status:'passed'},r).status,'error');
  }
});
test('classified AI 품질 실패와 종료 실패 보존', () => {
  const r = aiReport(); r.results[0].pass = false; r.results[0].checks.taskBijection = false;
  assert.equal(applyClassifiedReport({status:'passed'},r).status,'failed');
  assert.equal(applyClassifiedReport({status:'failed'},aiReport()).status,'failed');
});
test('classified AI 실행 오류/과부하/허위 통과 보존', () => {
  const r = aiReport(); r.results[0].pass = false; r.results[0].error = 'HTTP 500';
  assert.equal(applyClassifiedReport({status:'passed'},r).status,'error');
  assert.equal(applyClassifiedReport({status:'passed'},{...aiReport(),stopped:'OVERLOAD'}).status,'error');
  const forged = aiReport(); forged.results[0].checks.count = false;
  assert.equal(applyClassifiedReport({status:'passed'},forged).status,'error');
});

test('classified AI 잘못된 JSON 루트는 오류', () => {
  for (const report of [null, {}, [], {complete:true}]) assert.equal(applyClassifiedReport({status:'passed'},report).status,'error');
});
