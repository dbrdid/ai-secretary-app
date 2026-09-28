/**
 * 약관 동의 상태 — DTL-AUT-014(전체 동의 연동). 항목은 DTL-AUT-013을 따른다.
 *
 * [전체 동의]는 따로 저장하지 않고 하위 4개에서 계산한다. 따로 저장하면 "전체 동의는 켜졌는데
 * 하위 하나는 꺼진" 어긋난 상태가 생길 수 있다. 계산으로 두면 원문의 두 규칙
 * ("하나라도 해제하면 전체 동의 해제", "모두 체크되면 전체 동의 체크")이 저절로 지켜진다.
 */

/** DTL-AUT-013 순서: 만 14세 이상(필수), 서비스 이용약관(필수), 개인정보 수집·이용(필수), 마케팅 수신(선택) */
export const TERM_KEYS = ['age14', 'service', 'privacy', 'marketing'] as const;
export type TermKey = (typeof TERM_KEYS)[number];

/** 필수 3개. 가입 버튼 조건(DTL-AUT-016)이 쓴다. */
export const REQUIRED_TERMS: readonly TermKey[] = ['age14', 'service', 'privacy'];

export type TermsState = Readonly<Record<TermKey, boolean>>;

export const EMPTY_TERMS: TermsState = { age14: false, service: false, privacy: false, marketing: false };

/** [전체 동의] 체크 표시 여부. 선택 항목(마케팅)까지 4개가 모두 체크돼야 참이다. */
export function isAllAgreed(terms: TermsState): boolean {
  return TERM_KEYS.every((key) => terms[key]);
}

/** [전체 동의]를 체크하거나 해제하면 하위 항목이 모두 같은 값이 된다. */
export function setAllTerms(checked: boolean): TermsState {
  return { age14: checked, service: checked, privacy: checked, marketing: checked };
}

/**
 * 하위 항목 하나를 바꾼다. 약관 모달의 [동의](DTL-AUT-015)도 이 함수에 true를 넘기면 된다.
 * 전체 동의는 계산값이라 여기서 따로 고칠 것이 없다.
 */
export function setTerm(terms: TermsState, key: TermKey, checked: boolean): TermsState {
  return { ...terms, [key]: checked };
}

export function requiredTermsAgreed(terms: TermsState): boolean {
  return REQUIRED_TERMS.every((key) => terms[key]);
}
