/**
 * 키 입력 공통 도구.
 *
 * 한글 입력기(IME)로 글자를 조합하는 중에 누른 Enter는 글자를 확정하는 키다. 이것을 제출이나
 * 포커스 이동으로 처리하면 마지막 글자가 빠지거나 두 번 처리된다. 일부 브라우저(Safari 등)는
 * 조합을 끝내는 Enter의 keydown을 isComposing=false, keyCode=229로 보내므로 둘 다 본다.
 * 원문에 없는 구현 보완이다.
 */

export type KeyInput = {
  readonly key: string;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
};

export function isImeComposing(event: KeyInput): boolean {
  return event.isComposing === true || event.keyCode === 229;
}

/** 조합 중이 아닌 Enter인지 */
export function isPlainEnter(event: KeyInput): boolean {
  return event.key === 'Enter' && !isImeComposing(event);
}
