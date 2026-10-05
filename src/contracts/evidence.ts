/**
 * AI 결과의 근거 위치 — REQ-UX-005(DTL-UX-005 [근거 보기] 하이라이트) 계약. REQ-AST-003(답변 출처)도
 * 단계 7에서 같은 위치 형식을 쓴다.
 *
 * 결정과 이유
 * - 위치는 원본 ID와 원본 버전을 함께 가진다. 원본이 고쳐진 뒤 옛 위치로 하이라이트하면 엉뚱한 문장이
 *   칠해진다. 버전이 다르면 'sourceChanged'로 알리고 위치를 짐작하지 않는다.
 * - 텍스트 범위는 UTF-16 코드 단위의 [start, end)다. 브라우저 문자열과 DOM Range가 같은 단위라 변환 없이
 *   하이라이트할 수 있다. [합의 필요] AI·서버가 코드 포인트 단위(Python 등)로 세면 변환이 필요하다.
 * - 음성은 밀리초 [startMs, endMs), 문서(PDF·PPTX, DTL-INB-007)는 1부터 세는 쪽·슬라이드 번호다.
 *   사진 속 영역(OCR 좌표)은 아직 형식이 없다. 지원하지 않는 위치를 다른 형식으로 흉내 내지 않는다.
 * - 이동할 수 없으면 이유를 돌려준다. 가장 가까운 문장으로 대신 옮기지 않는다 — 근거를 못 찾았다는
 *   사실이 화면에 그대로 보여야 사용자가 AI 결과를 믿을지 판단할 수 있다.
 */

export type EvidenceLocation =
  | { readonly kind: 'text'; readonly sourceId: string; readonly sourceVersion: number; readonly start: number; readonly end: number }
  | { readonly kind: 'audio'; readonly sourceId: string; readonly sourceVersion: number; readonly startMs: number; readonly endMs: number }
  | { readonly kind: 'page'; readonly sourceId: string; readonly sourceVersion: number; readonly page: number };

/** 근거를 확인할 때 넘겨받는 원본 정보. 원본을 어디에 어떻게 저장하든 이 모양으로 맞춰 넘긴다. */
export type SourceSnapshot = {
  readonly id: string;
  readonly version: number;
  /** 휴지통에 있으면 true. 영구 삭제된 원본은 넘기지 않는다(undefined). */
  readonly inTrash: boolean;
  readonly content:
    | { readonly kind: 'text'; readonly text: string }
    | { readonly kind: 'audio'; readonly durationMs: number }
    | { readonly kind: 'document'; readonly pageCount: number };
};

export type EvidenceTarget =
  | { readonly status: 'ok'; readonly kind: 'text'; readonly start: number; readonly end: number; readonly excerpt: string }
  | { readonly status: 'ok'; readonly kind: 'audio'; readonly startMs: number; readonly endMs: number }
  | { readonly status: 'ok'; readonly kind: 'page'; readonly page: number }
  | { readonly status: 'sourceMissing' | 'sourceInTrash' | 'sourceChanged' | 'invalidLocation' };

const isCount = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** 원본 없이 볼 수 있는 모양 검사. AI 응답을 저장하기 전에 거를 때 쓴다. */
export function isWellFormedEvidence(loc: EvidenceLocation): boolean {
  if (loc.sourceId === '' || !isCount(loc.sourceVersion)) return false;
  switch (loc.kind) {
    case 'text':
      return isCount(loc.start) && isCount(loc.end) && loc.start < loc.end;
    case 'audio':
      return isCount(loc.startMs) && isCount(loc.endMs) && loc.startMs < loc.endMs;
    case 'page':
      return isCount(loc.page) && loc.page >= 1;
    default:
      return false; // 네트워크로 온 값에 모르는 kind가 섞여 있어도 받지 않는다
  }
}

/** 이모지처럼 두 칸을 쓰는 글자의 가운데를 자르는지. 가운데를 자르면 하이라이트가 깨진 글자로 보인다. */
function splitsSurrogatePair(text: string, index: number): boolean {
  const before = text.charCodeAt(index - 1); // 범위 밖이면 NaN이라 아래 비교가 모두 거짓이 된다
  const after = text.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

/**
 * [근거 보기]를 눌렀을 때 이동할 곳. 원본이 휴지통에 있으면 버전보다 먼저 알린다 — 사용자가 복원하면
 * 다시 볼 수 있는 경우라서다.
 */
export function resolveEvidence(loc: EvidenceLocation, source: SourceSnapshot | undefined): EvidenceTarget {
  if (!source || source.id !== loc.sourceId) return { status: 'sourceMissing' };
  if (source.inTrash) return { status: 'sourceInTrash' };
  if (source.version !== loc.sourceVersion) return { status: 'sourceChanged' };
  if (!isWellFormedEvidence(loc)) return { status: 'invalidLocation' };

  const content = source.content;
  if (loc.kind === 'text' && content.kind === 'text') {
    const { text } = content;
    if (loc.end > text.length || splitsSurrogatePair(text, loc.start) || splitsSurrogatePair(text, loc.end)) {
      return { status: 'invalidLocation' };
    }
    return { status: 'ok', kind: 'text', start: loc.start, end: loc.end, excerpt: text.slice(loc.start, loc.end) };
  }
  if (loc.kind === 'audio' && content.kind === 'audio') {
    if (loc.endMs > content.durationMs) return { status: 'invalidLocation' };
    return { status: 'ok', kind: 'audio', startMs: loc.startMs, endMs: loc.endMs };
  }
  if (loc.kind === 'page' && content.kind === 'document') {
    if (loc.page > content.pageCount) return { status: 'invalidLocation' };
    return { status: 'ok', kind: 'page', page: loc.page };
  }
  return { status: 'invalidLocation' }; // 위치 종류와 원본 종류가 다르다(예: 텍스트 범위인데 원본이 음성)
}
