import { schemaFor, validOutput } from './local-ai-contract.mjs';
// 기존 계약과 결과를 보존하면서 근거 역할을 분리한 실험을 비교한다.
export const presenceSchema = {
  type: 'object', additionalProperties: false, required: ['hasTask'],
  properties: { hasTask: { type: 'boolean' } },
};
export function validPresence(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).join(',') === 'hasTask' && typeof value.hasTask === 'boolean';
}
export function twoStageSchema(ids) {
  const schema = schemaFor(ids);
  const task = schema.properties.tasks.items;
  const evidence = task.properties.evidenceIds;
  delete task.properties.evidenceIds;
  task.required = ['title', 'assignee', 'due', 'contentEvidenceIds', 'assignmentEvidenceIds'];
  task.properties.contentEvidenceIds = evidence;
  task.properties.assignmentEvidenceIds = { ...evidence, minItems: 0 };
  return schema;
}
export function validTwoStageOutput(output, ids) {
  if (!output || Array.isArray(output) || typeof output !== 'object' ||
      Object.keys(output).join(',') !== 'tasks' || !Array.isArray(output.tasks)) return false;
  return output.tasks.every(task => {
    if (!task || Object.keys(task).sort().join(',') !==
        'assignee,assignmentEvidenceIds,contentEvidenceIds,due,title') return false;
    const assignments = task.assignmentEvidenceIds;
    if (!Array.isArray(assignments) || new Set(assignments).size !== assignments.length ||
        !assignments.every(id => ids.includes(id)) ||
        ((task.assignee !== null || task.due !== null) && assignments.length === 0)) return false;
    return validOutput({ tasks: [{
      title: task.title, assignee: task.assignee, due: task.due,
      evidenceIds: task.contentEvidenceIds,
    }] }, ids);
  });
}
