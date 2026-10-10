import { cases } from './local-ai-regression-cases.mjs';
// 기준 실행기를 import하면 AI가 실행되므로 데이터만 복사하고 동등성을 단위 검사한다.
const baseline = [...structuredClone(cases),
  { id: 'pure_refusal', text: '준호: 저는 검토 화면 초안을 맡지 않겠습니다.', expected: { count: 0 } },
  { id: 'required_after_refusal', text: '준호: 저는 검토 화면 초안을 맡지 않겠습니다.\n민지: 그래도 검토 화면 초안은 만들어야 합니다. 담당자와 기한은 미정입니다.', expected: { count: 1, titleTerms: ['검토', '초안'], assignee: null, due: null, evidence: '검토 화면 초안은 만들어야 합니다.' } },
  { id: 'cancelled_task', text: '민지: 검토 화면 초안을 만들어 주세요.\n민지: 초안 작성 업무 자체를 취소합니다. 만들지 마세요.', expected: { count: 0 } },
];
const labels = {
  explicit: [['assignment']], missing: [['necessity'], ['other']],
  reversal: [['assignment'], ['reassignment'], ['assignment']],
  other_assignee: [['assignment']], observation_only: [['necessity']],
  negated_self: [['refusal']], no_task: [['other'], ['other']], pure_refusal: [['refusal']],
  required_after_refusal: [['refusal'], ['necessity']], cancelled_task: [['assignment'], ['cancellation']],
};
const spec = (titleTerms, assignee, due, content, assignment, extra = {}) => ({ titleTerms, assignee, due,
  contentRequired: content, contentAllowed: content, assignmentRequired: assignment, assignmentAllowed: assignment, ...extra });
export const classifiedCases = baseline.map(item => {
  const content = item.id === 'required_after_refusal' ? ['s2'] : ['s1'];
  const assignment = ['missing', 'reversal'].includes(item.id) ? ['s2'] : content;
  return { ...item, expectedLabels: labels[item.id], expectedTasks: item.expected.count ? [spec(item.expected.titleTerms,
    item.expected.assignee, item.expected.due, content, assignment,
    { evidence: item.expected.evidence, ...(item.id === 'reversal' ? { assignmentAllowed: ['s2', 's3'] } : {}) })] : [] };
});
classifiedCases.push(
  { id: 'multi_independent', text: '민지: 준호 씨는 2026-10-09까지 검토 화면 초안을 만드세요.\n서연: 저는 2026-10-12까지 저장 복원 검증을 하겠습니다.',
    expectedLabels: [['assignment'], ['assignment']], expectedTasks: [spec(['검토', '초안'], '준호', '2026-10-09', ['s1'], ['s1']), spec(['저장', '검증'], '서연', '2026-10-12', ['s2'], ['s2'])] },
  { id: 'multi_selective_reassignment', text: '민지: 준호 씨가 2026-10-09까지 검토 화면 초안을 만들어 주세요.\n민지: 저장 복원 검증은 민지 담당이고 기한은 2026-10-12입니다.\n민지: 검토 화면 초안 담당만 서연 씨로 바꾸고 기한은 2026-10-11로 바꿉니다.',
    expectedLabels: [['assignment'], ['assignment'], ['reassignment']], expectedTasks: [spec(['검토', '초안'], '서연', '2026-10-11', ['s1'], ['s3'], { contentAllowed: ['s1', 's3'] }), spec(['저장', '검증'], '민지', '2026-10-12', ['s2'], ['s2'])] },
  { id: 'multi_selective_cancellation', text: '민지: 준호 씨가 2026-10-09까지 검토 화면 초안을 만들어 주세요.\n서연: 저는 2026-10-12까지 저장 복원 검증을 하겠습니다.\n민지: 검토 화면 초안 업무 자체만 취소합니다. 저장 복원 검증은 그대로 진행하세요.',
    expectedLabels: [['assignment'], ['assignment'], ['cancellation', 'assignment']], expectedTasks: [spec(['저장', '검증'], '서연', '2026-10-12', ['s2'], ['s2'], { contentAllowed: ['s2', 's3'], assignmentAllowed: ['s2', 's3'] })] },
  { id: 'refusal_plus_other_necessity', text: '준호: 저는 검토 화면 초안을 맡지 않겠습니다.\n민지: 저장 복원 검증은 반드시 필요합니다. 담당자와 기한은 미정입니다.',
    expectedLabels: [['refusal'], ['necessity']], expectedTasks: [spec(['저장', '검증'], null, null, ['s2'], ['s2'])] },
  { id: 'same_utterance_two_tasks', text: '민지: 준호 씨는 2026-10-09까지 검토 화면 초안을 만들고, 서연 씨는 2026-10-12까지 저장 복원 검증을 하세요.',
    expectedLabels: [['assignment']], expectedTasks: [spec(['검토', '초안'], '준호', '2026-10-09', ['s1'], ['s1']), spec(['저장', '검증'], '서연', '2026-10-12', ['s1'], ['s1'])] },
  { id: 'same_utterance_refusal_necessity', text: '준호: 저는 검토 화면 초안을 맡지 않지만 검토 화면 초안은 꼭 만들어야 합니다. 담당자와 기한은 미정입니다.',
    expectedLabels: [['refusal', 'necessity']], expectedTasks: [spec(['검토', '초안'], null, null, ['s1'], ['s1'])] },
  { id: 'new_necessity_phrase', text: '서연: 저장 복원 검증 없이는 출시할 수 없습니다. 이 검증은 꼭 해야 하고 담당자와 기한은 아직 미정입니다.',
    expectedLabels: [['necessity']], expectedTasks: [spec(['저장', '검증'], null, null, ['s1'], ['s1'])] },
  { id: 'same_title_different_targets', text: '민지: 로그인 화면 초안은 준호 씨가 2026-10-09까지 만드세요.\n민지: 설정 화면 초안은 서연 씨가 2026-10-12까지 만드세요.',
    expectedLabels: [['assignment'], ['assignment']], expectedTasks: [spec(['로그인', '초안'], '준호', '2026-10-09', ['s1'], ['s1']), spec(['설정', '초안'], '서연', '2026-10-12', ['s2'], ['s2'])] },
);
// 복수 업무 제목에 이웃 업무까지 합쳐 쓰는 오류도 담당자 검사와 별도로 잡는다.
for (const item of classifiedCases) {
  for (const task of item.expectedTasks) task.forbiddenTitleTerms = [...new Set(item.expectedTasks
    .filter(other => other !== task).flatMap(other => other.titleTerms).filter(term => !task.titleTerms.includes(term)))];
}
