const cases = [
  { id: 'explicit', text: '준호: 제가 2026-10-09까지 검토 화면 초안을 만들겠습니다.', expected: { assignee: '준호', due: '2026-10-09', evidence: '제가 2026-10-09까지 검토 화면 초안을 만들겠습니다.' } },
  { id: 'missing', text: '민지: 저장 후 다시 열리는지 검증해야 합니다.\n서연: 이 작업의 담당자와 기한은 아직 정하지 않았습니다.', expected: { assignee: null, due: null, evidence: '저장 후 다시 열리는지 검증해야 합니다.' } },
  { id: 'reversal', text: '민지: 준호 씨가 2026-10-09까지 검토 화면 초안을 만들어 주세요.\n민지: 방금 정한 담당자와 기한은 취소합니다. 이 작업은 서연 씨가 2026-10-11까지 맡아 주세요.\n서연: 네, 제가 맡겠습니다.', expected: { assignee: '서연', due: '2026-10-11', evidence: '이 작업은 서연 씨가 2026-10-11까지 맡아 주세요.' } },
];
// 자기 선언을 복원하되 모든 발언자를 담당자로 오인하지 않는지 함께 검사한다.
cases.push(
  { id: 'other_assignee', text: '민지: 준호 씨가 검토 화면 초안을 만들어 주세요.', expected: { assignee: '준호', due: null, evidence: '준호 씨가 검토 화면 초안을 만들어 주세요.' } },
  { id: 'observation_only', text: '준호: 검토 화면 초안이 필요합니다. 담당자는 아직 정하지 않았습니다.', expected: { assignee: null, due: null, evidence: '검토 화면 초안이 필요합니다.' } },
  { id: 'negated_self', text: '준호: 저는 검토 화면 초안을 맡지 않겠습니다. 담당자와 기한은 미정입니다.', expected: { assignee: null, due: null, evidence: '저는 검토 화면 초안을 맡지 않겠습니다.' } },
);
// 거절만 있는 문장은 실행할 업무가 아니다. 기존 검사의 강제 1건 기대를 명시적으로 정정한다.
// 필요성 발언은 담당 미정 후보로 유지하되, 확정된 배정으로 취급하지 않는다.
for (const item of cases) {
  item.expected.count = item.id === 'negated_self' ? 0 : 1;
  item.expected.titleTerms = item.id === 'missing' ? ['저장', '검증'] : ['검토', '초안'];
}
cases.push({ id: 'no_task', text: '민지: 안녕하세요.\n준호: 반갑습니다.', expected: { count: 0 } });

export { cases };
