import { createDraft, transcript, saveDraft, loadDraft, STORAGE_KEY } from './model.mjs';
const $ = id => document.getElementById(id);
let draft = createDraft();
let dirty = false;
let storageBroken = false;
let saveFailed = false;
let reviewDirty = false;
let baselineRaw = null;
// Decode the exact bytes used as the baseline, not a second potentially newer read.
function readSnapshot() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return { raw, saved: loadDraft({ getItem: () => raw }) };
}
function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
try {
  const { raw, saved } = readSnapshot();
  baselineRaw = raw;
  if (saved) { draft = saved; message('이 브라우저에 저장한 확정본을 복원했습니다.'); }
} catch (error) {
  // 손상된 확정본을 새 예시로 덮어쓰지 않도록 현재 탭의 저장을 잠근다.
  storageBroken = true; message('저장소를 읽지 못했습니다. 덮어쓰기를 막기 위해 저장을 중지했습니다. ' + error.message, true);
}
for (const segment of transcript) {
  const item = document.createElement('article');
  item.className = 'utterance'; item.id = segment.id; item.tabIndex = -1;
  const speaker = document.createElement('strong'); speaker.textContent = segment.speaker;
  const content = document.createElement('p'); content.textContent = segment.text;
  item.append(speaker, content); $('transcript').append(item);
}
const fields = ['title', 'summary', 'discussion', 'decisions', 'unresolved'];
for (const field of fields) $(field).value = draft[field];
draft.tasks.forEach((task, index) => {
  const container = document.createElement('article'); container.className = 'task';
  const grid = document.createElement('div'); grid.className = 'task-grid';
  for (const [key, title] of [['title', '할 일'], ['assignee', '담당자 후보'], ['due', '기한 후보']]) {
    const label = document.createElement('label'); label.textContent = title;
    const input = document.createElement('input');
    input.id = 'task-' + index + '-' + key; input.name = input.id;
    input.value = task[key]; input.type = key === 'due' ? 'date' : 'text';
    input.maxLength = 20000; input.required = key === 'title';
    if (key !== 'title') input.placeholder = '확인 필요';
    label.append(input); (key === 'title' ? container : grid).append(label);
  }
  container.append(grid);
  const note = document.createElement('p'); note.className = 'help'; note.textContent = '빈 담당자·기한 = 확인 필요';
  const evidence = document.createElement('button'); evidence.type = 'button'; evidence.className = 'evidence';
  evidence.dataset.evidence = task.evidenceId; evidence.textContent = '원문 근거 ↗';
  note.id = 'task-' + index + '-help';
  container.setAttribute('aria-label', '후속 업무 ' + (index + 1));
  grid.querySelectorAll('input').forEach(input => input.setAttribute('aria-describedby', note.id));
  evidence.setAttribute('aria-label', '후속 업무 ' + (index + 1) + ' 원문 근거');
  container.append(note, evidence); $('tasks').append(container);
});
function applySnapshot({ raw, saved }) {
  draft = saved;
  baselineRaw = raw;
  dirty = false; reviewDirty = false; storageBroken = false; saveFailed = false;
  for (const field of fields) $(field).value = draft[field];
  draft.tasks.forEach((task, i) => {
    for (const key of ['title', 'assignee', 'due']) $('task-' + i + '-' + key).value = task[key];
  });
  $('reviewed').checked = false;
  updateState();
}
function blockStorage(text) {
  storageBroken = true;
  updateState();
  message(text + ' 입력과 검토 상태는 유지됩니다. 최신본 불러오기로 다시 확인해 주세요.', true);
}
function receiveStorage() {
  try {
    const snapshot = readSnapshot();
    if (!snapshot.saved) {
      blockStorage('다른 탭에서 저장본이 삭제되었거나 비어 있습니다. 저장을 차단했습니다.');
    } else if (snapshot.raw !== baselineRaw || storageBroken) {
      if (dirty || reviewDirty) {
        blockStorage('다른 탭에서 저장소가 변경되었습니다. 미저장 변경 보호를 위해 저장을 차단했습니다.');
      } else {
        applySnapshot(snapshot);
        message('다른 탭의 최신 저장본을 자동 반영했습니다. 원문을 다시 검토해 주세요.');
      }
    }
  } catch (error) {
    blockStorage('저장소를 읽지 못했습니다. 저장을 차단했습니다. ' + error.message);
  }
}
$('load-latest').addEventListener('click', () => {
  if ((dirty || reviewDirty) && !window.confirm('미저장 입력과 검토 상태를 버리고 최신 저장본을 불러올까요?')) return;
  // Read after confirmation: another tab may save while the dialog is open.
  try {
    const snapshot = readSnapshot();
    if (!snapshot.saved) { blockStorage('불러올 저장본이 없습니다. 저장을 차단했습니다.'); return; }
    applySnapshot(snapshot);
    message('최신 저장본을 불러왔습니다. 원문을 다시 검토해 주세요.');
  } catch (error) {
    blockStorage('저장소를 읽지 못했습니다. 저장을 차단했습니다. ' + error.message);
  }
});
// Derive from live controls so unsaved edits and restored snapshots share one view.
function updateOverview() {
  const rows = draft.tasks.map((task, i) => ({
    index: i,
    title: $('task-' + i + '-title').value.trim(),
    assignee: $('task-' + i + '-assignee').value.trim(),
    due: $('task-' + i + '-due').value.trim(),
  }));
  $('overview-state').textContent = $('state').textContent + ' — ' + $('save-guidance').textContent;
  $('task-total').textContent = rows.length + '건';
  $('task-missing-assignee').textContent = rows.filter(t => !t.assignee).length + '건';
  $('task-missing-due').textContent = rows.filter(t => !t.due).length + '건';
  $('task-needs-check').textContent = rows.filter(t => !t.title || !t.assignee || !t.due).length + '건';
  // Preserve focused links during input and snapshot updates.
  for (const row of rows) {
    let item = $('task-summary-' + row.index);
    if (!item) {
      item = document.createElement('li'); item.id = 'task-summary-' + row.index;
      const link = document.createElement('a');
      const target = 'task-' + row.index + '-title';
      link.href = '#' + target; link.dataset.editTarget = target;
      item.append(link, document.createElement('span'));
      $('task-summary-list').append(item);
    }
    item.firstElementChild.textContent = '업무 ' + (row.index + 1) + ' 편집: ' + (row.title || '제목 미입력');
    const missing = [['title', '제목'], ['assignee', '담당자'], ['due', '기한']].filter(([key]) => !row[key]).map(([,label]) => label);
    item.lastElementChild.textContent = missing.length ? missing.join('·') + ' 미입력 · 확인 필요' : '빈 항목 없음 · 내용 검토 필요';
  }
}
document.addEventListener('click', event => {
  const link = event.target.closest('[data-edit-target]');
  if (!link) return;
  const target = $(link.dataset.editTarget);
  if (!target) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
});
function updateState() {
  const reviewed = $('reviewed').checked;
  // Storage safety takes precedence over review readiness; a checkmark is not a saved result.
  const tone = storageBroken || saveFailed ? 'error' : reviewed ? 'ready' : dirty ? 'dirty' : draft.status === 'confirmed' ? 'saved' : 'pending';
  $('state').dataset.tone = tone;
  $('state').textContent = storageBroken ? '저장 차단' : saveFailed ? '저장 실패 · 미저장' : reviewed ? '검토 완료 · 저장 전' : dirty ? '수정됨 · 재검토 필요' : draft.status === 'confirmed' ? '사용자 확정 · 예시' : '검토 대기';
  $('save-guidance').textContent = storageBroken
    ? '저장이 차단되었습니다. 아래 오류 안내를 확인하고 최신본을 불러와 주세요.'
    : saveFailed ? '저장하지 못했습니다. 입력은 유지됩니다. 아래 오류를 확인한 뒤 다시 저장해 주세요.'
    : reviewed ? '검토 확인을 마쳤습니다. 확정하고 저장을 눌러야 이 브라우저에 반영됩니다.'
    : dirty ? '미저장 변경이 있습니다. 원문을 다시 검토하고 확인란을 선택해 주세요.'
    : draft.status === 'confirmed' ? '저장된 확정본입니다. 다시 저장하려면 원문을 검토하고 확인란을 선택해 주세요.'
    : '아직 저장 전입니다. 원문과 초안을 검토하고 확인란을 선택하면 저장할 수 있습니다.';
  $('saved-at').textContent = draft.savedAt ? '마지막 저장: ' + new Date(draft.savedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' (서울)' : '아직 저장하지 않았습니다.';
  $('save').disabled = storageBroken || !$('reviewed').checked;
  updateOverview();
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-evidence]');
  if (!button) return;
  const target = $(button.dataset.evidence);
  if (!target) { message('원문 근거를 찾을 수 없습니다.', true); return; }
  document.querySelectorAll('.utterance').forEach(node => node.classList.remove('selected'));
  target.classList.add('selected'); target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
});
$('review-form').addEventListener('input', event => {
  if (event.target.id === 'reviewed') reviewDirty = true;
  else { saveFailed = false; dirty = true; $('reviewed').checked = false; if (!storageBroken) message('수정한 내용은 아직 저장되지 않았습니다. 근거를 다시 확인해 주세요.'); }
  updateState();
});
$('review-form').addEventListener('submit', event => {
  event.preventDefault();
  if (storageBroken) return;
  // This catches delayed notifications, but is not an atomic compare-and-set.
  try {
    if (window.localStorage.getItem(STORAGE_KEY) !== baselineRaw) {
      blockStorage('다른 탭에서 저장소가 변경되었습니다. 오래된 저장을 차단했습니다.');
      return;
    }
  } catch (error) {
    blockStorage('저장소를 읽지 못했습니다. 저장을 차단했습니다. ' + error.message);
    return;
  }
  const next = { ...draft };
  for (const field of fields) next[field] = $(field).value;
  next.tasks = draft.tasks.map((task, i) => ({
    ...task, title: $('task-' + i + '-title').value,
    assignee: $('task-' + i + '-assignee').value, due: $('task-' + i + '-due').value,
  }));
  try {
    draft = saveDraft(window.localStorage, next, $('reviewed').checked);
    baselineRaw = JSON.stringify(draft);
    saveFailed = false; dirty = false; reviewDirty = false; $('reviewed').checked = false; updateState();
    message('확정본을 이 브라우저에 저장했습니다. 새로고침 후 다시 확인할 수 있습니다. 담당자·기한 공란은 확인 필요로 유지됩니다.');
  } catch (error) { saveFailed = true; updateState(); message('저장하지 못했습니다. 입력 내용은 화면에 남아 있습니다. ' + error.message, true); }
});
window.addEventListener('beforeunload', event => { if (dirty || reviewDirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    if (event.storageArea !== window.localStorage) return;
  } catch (error) {
    blockStorage('저장소를 읽지 못했습니다. 저장을 차단했습니다. ' + error.message);
    return;
  }
  // Payloads can be stale; only the current storage snapshot is authoritative.
  receiveStorage();
});
updateState();
