import { twoStageSchema, validTwoStageOutput } from './local-ai-two-stage-contract.mjs';
export { twoStageSchema };
export const labels = ['necessity', 'assignment', 'refusal', 'reassignment', 'cancellation', 'other'];
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
const unique = xs => new Set(xs).size === xs.length;
export function classificationSchema(ids) {
  return { type: 'object', additionalProperties: false, required: ['utterances'], properties: { utterances: {
    type: 'array', minItems: ids.length, maxItems: ids.length, items: {
      type: 'object', additionalProperties: false, required: ['id', 'labels'], properties: {
        id: { type: 'string', enum: ids }, labels: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: labels } },
      },
    },
  } } };
}
export function validClassification(value, ids) {
  return !!(keys(value, ['utterances']) && Array.isArray(value.utterances) && value.utterances.length === ids.length &&
    unique(value.utterances.map(u => u?.id)) && value.utterances.every(u => keys(u, ['id', 'labels']) && ids.includes(u.id) &&
      Array.isArray(u.labels) && u.labels.length > 0 && unique(u.labels) && u.labels.every(l => labels.includes(l)) &&
      (!u.labels.includes('other') || u.labels.length === 1)));
}
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const evidenceCheck = (actual, required, allowed) => required.every(id => actual.includes(id)) && actual.every(id => allowed.includes(id));
export function compareTask(task, expected, segments) {
  const textFor = ids => segments.filter(s => ids.includes(s.id)).map(s => s.text).join('\n');
  const content = textFor(task.contentEvidenceIds), assignment = textFor(task.assignmentEvidenceIds);
  return {
    title: expected.titleTerms.every(term => task.title.includes(term)) && !(expected.forbiddenTitleTerms || []).some(term => task.title.includes(term)),
    titleSupportedByContentEvidence: expected.titleTerms.every(term => content.includes(term)),
    assignee: task.assignee === expected.assignee, due: task.due === expected.due,
    contentEvidence: evidenceCheck(task.contentEvidenceIds, expected.contentRequired, expected.contentAllowed),
    assignmentEvidence: evidenceCheck(task.assignmentEvidenceIds, expected.assignmentRequired, expected.assignmentAllowed),
    evidenceContainsExpected: !expected.evidence || (content + '\n' + assignment).includes(expected.evidence),
    dueInAssignmentEvidence: expected.due === null || assignment.includes(expected.due),
    assigneeInAssignmentEvidence: expected.assignee === null || assignment.includes(expected.assignee),
  };
}
// 첫 제목 일치만 고르면 비슷한 업무를 오연결하므로 모든 필드가 맞는 최대 일대일 대응을 찾는다.
export function maximumMatching(edges, actualCount) {
  const owners = Array(actualCount).fill(-1);
  function visit(e, seen) {
    for (const a of edges[e]) {
      if (seen.has(a)) continue;
      seen.add(a);
      if (owners[a] === -1 || visit(owners[a], seen)) { owners[a] = e; return true; }
    }
    return false;
  }
  edges.forEach((_, e) => visit(e, new Set()));
  return owners.flatMap((e, a) => e < 0 ? [] : [{ expectedIndex: e, actualIndex: a }]);
}
export function evaluateClassified(item, classification, output, segments) {
  const ids = segments.map(s => s.id);
  const classificationValid = validClassification(classification, ids);
  const schemaValid = validTwoStageOutput(output, ids);
  const utteranceChecks = ids.map((id, index) => ({ id, expected: item.expectedLabels[index],
    actual: classification?.utterances?.find?.(u => u?.id === id)?.labels,
    pass: classificationValid && sameSet(classification.utterances.find(u => u.id === id).labels, item.expectedLabels[index]),
  }));
  const matrix = schemaValid ? item.expectedTasks.map(e => output.tasks.map(t => compareTask(t, e, segments))) : [];
  const matches = maximumMatching(matrix.map(row => row.flatMap((checks, a) => Object.values(checks).every(Boolean) ? [a] : [])), schemaValid ? output.tasks.length : 0);
  const missingExpected = item.expectedTasks.flatMap((_, e) => matches.some(m => m.expectedIndex === e) ? [] : [e]);
  const unmatchedActual = schemaValid ? output.tasks.flatMap((_, a) => matches.some(m => m.actualIndex === a) ? [] : [a]) : [];
  const checks = { classificationValid, utteranceLabels: utteranceChecks.every(u => u.pass), schemaValid,
    count: schemaValid && output.tasks.length === item.expectedTasks.length,
    taskBijection: schemaValid && missingExpected.length === 0 && unmatchedActual.length === 0 };
  return { checks, utteranceChecks, taskChecks: matrix, matches, missingExpected, unmatchedActual, pass: Object.values(checks).every(Boolean) };
}
