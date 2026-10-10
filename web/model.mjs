export const STORAGE_KEY = 'ai-secretary:desktop-demo:v1';
export const transcript = [
  { id: 's1', speaker: '민지', text: '이번 발표는 컴퓨터 웹에서 회의 기록을 문서와 후속 업무로 연결하는 흐름을 보여주겠습니다.' },
  { id: 's2', speaker: '준호', text: '제가 2026-10-09까지 검토 화면 초안을 만들겠습니다.' },
  { id: 's3', speaker: '민지', text: '모바일 실제 연동은 이번 발표 범위에서 제외하겠습니다. 저장 후 다시 열리는지도 확인해야 합니다.' },
  { id: 's4', speaker: '서연', text: '저장 검증의 담당자와 기한은 아직 정하지 않았습니다. 추후 확인합시다.' },
];
export function createDraft() {
  return {
    schemaVersion: 1, id: 'meeting-demo-1', mode: 'example', status: 'draft', savedAt: null,
    title: '컴퓨터 웹 중간 발표 준비',
    summary: '회의 기록을 회의록과 후속 업무로 연결하는 컴퓨터 웹을 시연한다.',
    discussion: '원문 근거를 확인하고 사용자가 초안을 수정·확정하는 흐름을 우선한다.',
    decisions: '이번 발표에서 모바일 실제 연동은 제외한다.',
    unresolved: '저장 검증 담당자와 기한은 확인이 필요하다.',
    tasks: [
      { id: 't1', title: '검토 화면 초안 만들기', assignee: '준호', due: '2026-10-09', evidenceId: 's2' },
      { id: 't2', title: '저장 후 다시 열기 검증', assignee: '', due: '', evidenceId: 's3' },
    ],
  };
}
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export function validateDraft(d) {
  if (!d || d.schemaVersion !== 1 || d.id !== 'meeting-demo-1' || d.mode !== 'example') return false;
  if (!['draft', 'confirmed'].includes(d.status)) return false;
  if (!['title', 'summary', 'discussion', 'decisions', 'unresolved'].every(k => typeof d[k] === 'string' && d[k].length <= 20000)) return false;
  if (!d.title.trim() || !d.summary.trim()) return false;
  if (d.savedAt !== null && (typeof d.savedAt !== 'string' || !Number.isFinite(Date.parse(d.savedAt)))) return false;
  if (d.status === 'confirmed' && d.savedAt === null) return false;
  if (!Array.isArray(d.tasks) || d.tasks.length !== 2) return false;
  return d.tasks.every((t, i) => t && t.id === 't' + (i + 1) &&
    typeof t.title === 'string' && !!t.title.trim() && t.title.length <= 20000 &&
    typeof t.assignee === 'string' && t.assignee.length <= 20000 &&
    typeof t.due === 'string' && (t.due === '' || validDate(t.due)) &&
    t.evidenceId === ['s2', 's3'][i]);
}
export function saveDraft(storage, draft, reviewed, now = new Date().toISOString()) {
  if (!reviewed) throw new Error('내용과 원문 근거를 검토한 뒤 확인란을 선택해 주세요.');
  const saved = { ...draft, status: 'confirmed', savedAt: now };
  if (!validateDraft(saved)) throw new Error('제목·요약·할 일 제목과 날짜 형식을 확인해 주세요.');
  // 같은 회의의 확정본을 갱신하여 반복 클릭이 새 업무를 중복 생성하지 않게 한다.
  storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}
export function loadDraft(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  let draft;
  try { draft = JSON.parse(raw); } catch { throw new Error('저장된 데이터를 읽을 수 없습니다. 기존 데이터는 그대로 보존했습니다.'); }
  if (!validateDraft(draft)) throw new Error('저장된 데이터 형식이 맞지 않습니다. 기존 데이터는 그대로 보존했습니다.');
  return draft;
}
