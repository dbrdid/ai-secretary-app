import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifiedCases } from './local-ai-classified-cases.mjs';

export function classify(result) {
  if (result.error || result.signal || result.status === null) return 'error';
  return result.status === 0 ? 'passed' : 'failed';
}
export function summarize(results) {
  return Object.fromEntries(['passed', 'failed', 'error', 'not_run'].map(s => [s, results.filter(r => r.status === s).length]));
}
export function applySTTReport(result, report) {
  const expected = ['assignment', 'negation', 'reversal', 'necessity', 'silence'];
  const cases = report.results;
  if (!report.complete || !Array.isArray(cases) || cases.length !== expected.length ||
      new Set(cases.map(r => r.id)).size !== expected.length ||
      !expected.every(id => cases.some(r => r.id === id)) ||
      cases.some(r => !['passed', 'failed', 'error'].includes(r.status))) {
    return { ...result, status: 'error', complete: false, error: 'Incomplete or invalid STT report' };
  }
  const status = result.status === 'error' || cases.some(r => r.status === 'error') ? 'error'
    : result.status === 'failed' || cases.some(r => r.status === 'failed') ? 'failed' : 'passed';
  return { ...result, status, complete: true, cases };
}
export function applyClassifiedReport(result, report) {
  const expected = classifiedCases.map(c => c.id);
  const cases = report?.results;
  if (!report || report.error || report.stopped || !report.complete || !Array.isArray(cases) || cases.length !== expected.length ||
      new Set(cases.map(r => r.id)).size !== expected.length || !expected.every(id => cases.some(r => r.id === id)) ||
      cases.some(r => typeof r.pass !== 'boolean' || !r.checks || typeof r.checks !== 'object' || Array.isArray(r.checks) ||
        !['classificationValid', 'utteranceLabels', 'schemaValid', 'count', 'taskBijection', 'generationComplete'].every(k => typeof r.checks[k] === 'boolean') ||
        r.pass !== (!r.error && Object.values(r.checks).every(Boolean)))) {
    return { ...result, status: 'error', complete: false, error: report?.error || report?.stopped || 'Incomplete or invalid classified AI report' };
  }
  const status = result.status === 'error' || cases.some(r => r.error) ? 'error'
    : result.status === 'failed' || cases.some(r => !r.pass) ? 'failed' : 'passed';
  return { ...result, status, complete: true, rawReportPath: report.rawReportPath,
    cases: cases.map(r => ({ id: r.id, pass: r.pass, failedChecks: Object.entries(r.checks).filter(([,v]) => !v).map(([k]) => k), error: r.error })) };
}
export function parseHelperOptions(args) {
  if (args.some(a => !['--ai', '--stt', '--ai-classified'].includes(a))) throw new Error('지원 옵션: --ai --stt --ai-classified');
  return [args.includes('--ai'), args.includes('--stt'), args.includes('--ai-classified')];
}
export function runSuite(includeAI = false, includeSTT = false, includeClassifiedAI = false) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const folder = resolve(root, 'docs/test-runs', new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
  mkdirSync(folder, { recursive: true });
  const results = [];
  const jobs = [
    ['core', 'npm', ['run', 'check']],
    ['web', 'npm', ['run', 'test:web']],
    ['contracts', process.execPath, ['--test', 'scripts/local-ai-contract.test.mjs', 'scripts/local-ai-two-stage-contract.test.mjs', 'scripts/local-ai-classified-contract.test.mjs', 'scripts/test-helper.test.mjs']],
    ['browser', process.execPath, ['scripts/verify-browser.mjs']],
  ];
  if (includeAI) jobs.push(['ai-two-stage', process.execPath, ['scripts/verify-local-ai-two-stage.mjs']]);
  if (includeClassifiedAI) jobs.push(['ai-classified', process.execPath, ['scripts/verify-local-ai-classified.mjs']]);
  if (includeSTT) {
    jobs.push(['stt-metrics', resolve(root, 'sources/stt-validation/venv/bin/python'), ['scripts/test_stt_metrics.py']]);
    jobs.push(['stt', resolve(root, 'sources/stt-validation/venv/bin/python'), ['scripts/verify-stt.py']]);
  }
  // 한 검사 실패가 뒤의 검사를 숨기지 않도록 순차 실행 후 모두 집계한다.
  for (const [id, command, args] of jobs) {
    const start = Date.now();
    const output = resolve(folder, id + '.json');
    const run = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: id.startsWith('ai') || id === 'stt' ? 600000 : 120000,
      maxBuffer: 16 * 1024 * 1024, env: { ...process.env, AI_REPORT_PATH: output, AI_CLASSIFIED_REPORT_PATH: output, STT_REPORT_PATH: output, OMP_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '1', HF_HUB_OFFLINE: '1' } });
    writeFileSync(resolve(folder, id + '.log'), (run.stdout || '') + (run.stderr || ''));
    let result = { id, status: classify(run), exitCode: run.status, signal: run.signal, error: run.error?.message, elapsedMs: Date.now() - start };
    if (id === 'ai-classified') {
      try { result = applyClassifiedReport(result, JSON.parse(readFileSync(output, 'utf8'))); }
      catch (error) { result.status = 'error'; result.error = error.message; }
    }
    if (id === 'ai-two-stage') {
      try {
        const report = JSON.parse(readFileSync(output, 'utf8'));
        result.cases = report.results.map(r => ({ id: r.id, pass: r.pass, failedChecks: Object.entries(r.checks || {}).filter(([,v]) => !v).map(([k]) => k), error: r.error }));
        result.complete = report.complete;
        if (!report.complete) result.status = 'error';
      } catch (error) { result.status = 'error'; result.error = error.message; }
    }
    if (id === 'stt') {
      try { result = applySTTReport(result, JSON.parse(readFileSync(output, 'utf8'))); }
      catch (error) { result.status = 'error'; result.error = error.message; }
    }
    results.push(result);
    console.log(id + ': ' + result.status);
    if (id === 'ai-classified' && result.status === 'error') {
      for (const [pending] of jobs.slice(jobs.findIndex(j => j[0] === id) + 1)) results.push({ id: pending, status: 'not_run', reason: 'classified AI 실행 오류 후 부하 보호 중단' });
      break;
    }
  }
  if (!includeAI) results.push({ id: 'ai-two-stage', status: 'not_run', reason: '--ai 선택 시 로컬 합성 입력 검증' });
  if (!includeSTT) results.push({ id: 'stt', status: 'not_run', reason: '--stt 선택 시 로컬 합성 음성 검증. 실제 회의 품질 검증은 별도.' });
  const report = { startedAtFolder: folder, finishedAt: new Date().toISOString(), scope: '웹 회귀·선택적 합성 AI/STT 검증. 실제 회의·발화 경계 정확도·웹 AI 연결·시각 품질·다중 탭은 검증하지 않음.', results, counts: summarize(results) };
  writeFileSync(resolve(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(folder, 'README.md'), '# 테스트 실행 결과\n\n' + results.map(r => '- ' + r.id + ': ' + r.status + (r.reason ? ' — ' + r.reason : '')).join('\n') + '\n\n상세: report.json 및 각 .log. 미실행은 통과가 아닙니다.\n');
  console.log(folder);
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let options;
  try { options = parseHelperOptions(args); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
  if (options) {
    const report = runSuite(...options);
    process.exitCode = report.counts.failed || report.counts.error ? 1 : report.counts.not_run ? 2 : 0;
  }
}
