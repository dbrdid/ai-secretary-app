// 근거 문구를 모델이 재작성하지 않도록 원문 ID만 받고 실제 문장은 원본에서 찾는다.
export function schemaFor(ids) {
  return {
    type: 'object', additionalProperties: false, required: ['tasks'],
    properties: { tasks: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['title', 'assignee', 'due', 'evidenceIds'],
      properties: {
        title: { type: 'string', minLength: 1 },
        assignee: { type: ['string', 'null'] },
        due: { type: ['string', 'null'] },
        evidenceIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: ids } },
      },
    } } },
  };
}
export function validOutput(output, ids) {
  if (!output || Array.isArray(output) || typeof output !== 'object' ||
      Object.keys(output).length !== 1 || !Array.isArray(output.tasks)) return false;
  return output.tasks.every(task =>
    task && typeof task === 'object' && !Array.isArray(task) &&
    Object.keys(task).sort().join(',') === 'assignee,due,evidenceIds,title' &&
    typeof task.title === 'string' && task.title.trim().length > 0 &&
    !['할 일', '할일', 'task'].includes(task.title.trim().toLowerCase()) &&
    (task.assignee === null || (typeof task.assignee === 'string' && task.assignee.trim().length > 0)) &&
    (task.due === null || (typeof task.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.due))) &&
    Array.isArray(task.evidenceIds) && task.evidenceIds.length > 0 &&
    new Set(task.evidenceIds).size === task.evidenceIds.length &&
    task.evidenceIds.every(id => ids.includes(id)));
}
