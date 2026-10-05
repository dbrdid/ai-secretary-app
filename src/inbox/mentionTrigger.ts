/**
 * 태그·멘션 입력 감지 — DTL-INB-002(상위 REQ-INB-002).
 * 원문: 텍스트 본문 작성 중 '#' 입력 시 태그 목록, '@' 입력 시 프로젝트 및 담당자 멘션 팝업을 띄운다.
 * 팝업 모양은 화면 몫이다. 여기서는 (1) 지금 커서 위치에서 팝업을 띄울지와 검색어, (2) 후보 거르기,
 * (3) 고른 후보를 본문에 넣은 결과를 계산한다. 본문 문자열과 커서 위치(UTF-16 단위, textarea.selectionStart와 같음)만
 * 받아 화면 구현(웹·앱)과 무관하게 쓴다.
 *
 * 결정과 이유
 * - [해석] '#'·'@'가 본문 처음이나 공백·줄바꿈 바로 뒤에 올 때만 팝업을 띄운다. 그렇지 않으면 메일 주소
 *   (kim@example.com)나 'C#'·링크의 '#'을 칠 때마다 팝업이 뜬다.
 * - 검색어는 기호 뒤부터 커서까지다. 공백을 치면 끝난다. 고르면 기호부터 그 낱말 끝까지(커서 뒤 글자 포함)를 바꾼다 —
 *   낱말 가운데를 고쳐 고를 때 뒷부분이 남아 '#회의록록'처럼 되지 않게 한다.
 * - 한글 입력기의 조합 중 글자도 본문에 들어온 대로 본다. 조합이 끝날 때까지 기다리면 첫 글자에서 팝업이 늦게 뜬다.
 * - [합의 필요] 태그에 쓸 수 있는 글자, 목록에 없는 새 태그를 바로 만들지, 본문의 '#회의' 글자와 저장값(tags·projectId)을
 *   어떻게 맞출지(본문에서 지우면 태그도 빠지는지), 이름에 공백이 있는 프로젝트, 메모의 담당자를 저장할 칸은 원문에
 *   없다(docs/open-decisions.md OD-19). 그래서 저장값은 여기서 만들지 않는다.
 */

export type TriggerKind = 'tag' | 'mention';

export type ActiveTrigger = {
  readonly kind: TriggerKind;
  /** 기호 뒤부터 커서까지. 기호만 쳤으면 ''. */
  readonly query: string;
  /** 기호의 위치 */
  readonly start: number;
  /** 바꿀 낱말의 끝(다음 공백 앞, 없으면 본문 끝) */
  readonly end: number;
};

const SYMBOL_KIND: Readonly<Record<string, TriggerKind>> = { '#': 'tag', '@': 'mention' };
const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

/** 커서 위치에서 팝업을 띄울지. 띄우지 않으면 null. */
export function findActiveTrigger(text: string, caret: number): ActiveTrigger | null {
  const at = Math.max(0, Math.min(caret, text.length));
  let start = at;
  while (start > 0 && !isSpace(text[start - 1])) start -= 1;
  if (start === at) return null; // 커서 바로 앞이 공백이거나 본문 처음
  const kind = SYMBOL_KIND[text[start] ?? ''];
  if (kind === undefined) return null;
  let end = at;
  while (end < text.length && !isSpace(text[end])) end += 1;
  return { kind, query: text.slice(start + 1, at), start, end };
}

/** 후보를 거른다. 대소문자 무시, 앞에서부터 맞는 것 먼저, 그다음 중간에 들어 있는 것. 검색어가 비면 전부. */
export function rankCandidates<T>(candidates: readonly T[], query: string, labelOf: (candidate: T) => string, limit = 20): T[] {
  const norm = (s: string) => s.normalize('NFC').toLowerCase();
  const q = norm(query);
  if (q === '') return candidates.slice(0, limit);
  const prefix: T[] = [];
  const inside: T[] = [];
  for (const c of candidates) {
    const label = norm(labelOf(c));
    if (label.startsWith(q)) prefix.push(c);
    else if (label.includes(q)) inside.push(c);
  }
  return [...prefix, ...inside].slice(0, limit);
}

/**
 * 고른 후보를 본문에 넣는다. 기호와 이름을 넣고, 바로 뒤가 공백이 아니면 공백 하나를 붙여 다음 글자가 이어
 * 붙지 않게 한다. 커서는 넣은 글자(와 공백) 뒤로 간다.
 */
export function applyCandidate(text: string, trigger: ActiveTrigger, label: string): { readonly text: string; readonly caret: number } {
  const symbol = trigger.kind === 'tag' ? '#' : '@';
  const after = text.slice(trigger.end);
  const inserted = symbol + label + (isSpace(after[0]) ? '' : ' ');
  const caret = trigger.start + inserted.length + (isSpace(after[0]) ? 1 : 0);
  return { text: text.slice(0, trigger.start) + inserted + after, caret };
}
