/**
 * 가입 버튼 활성화 조건 — DTL-AUT-016.
 * 원문: 모든 필수 필드가 유효하고 필수 약관 3개에 동의한 경우에만 [가입하기] 버튼을 활성화한다.
 *
 * [임시 가정] 이메일은 형식 검사(DTL-AUT-003)에 더해 중복 확인(DTL-AUT-004)에서 '사용 가능'을
 * 받아야 유효로 본다. 확인 중·중복·확인 실패(예: DTL-AUT-005의 429)면 버튼은 꺼진다.
 *
 * 중복 확인 결과에는 확인한 이메일을 함께 적는다. 이메일을 고친 뒤에도 예전 결과로 버튼이
 * 켜지거나, 늦게 도착한 예전 응답이 새 이메일을 '사용 가능'으로 바꾸는 일을 막으려는 것이다.
 */

import { type SignupField, type SignupValues, checkEmail, normalizeEmail, validateSignupFields } from './signupRules.ts';
import { type TermsState, requiredTermsAgreed } from './terms.ts';

export type EmailCheckResult = 'available' | 'duplicate' | 'failed';

export type EmailCheckState =
  | { readonly status: 'idle' }
  | { readonly status: 'checking'; readonly email: string }
  | { readonly status: EmailCheckResult; readonly email: string };

export const EMAIL_CHECK_IDLE: EmailCheckState = { status: 'idle' };

/**
 * 이 이메일로 중복 확인을 새로 해야 하는지. Blur 때와 입력값 복원(DTL-AUT-020) 뒤에 부른다.
 * 형식이 틀렸으면 부르지 않는다(DTL-AUT-004: 형식 검사를 통과하면 호출).
 * 같은 이메일을 이미 확인 중이거나 결과가 있으면 다시 부르지 않고, 실패했으면 다시 부른다.
 */
export function needsEmailCheck(rawEmail: string, check: EmailCheckState): boolean {
  if (!checkEmail(rawEmail).valid) return false;
  const email = normalizeEmail(rawEmail);
  if (check.status === 'idle' || check.status === 'failed') return true;
  return check.email !== email;
}

export function startEmailCheck(rawEmail: string): EmailCheckState {
  return { status: 'checking', email: normalizeEmail(rawEmail) };
}

/** 응답을 반영한다. 지금 확인 중인 그 이메일의 응답이 아니면 버린다. */
export function resolveEmailCheck(current: EmailCheckState, checkedEmail: string, result: EmailCheckResult): EmailCheckState {
  if (current.status !== 'checking' || current.email !== checkedEmail) return current;
  return { status: result, email: checkedEmail };
}

export type SignupBlocker = SignupField | 'emailCheck' | 'requiredTerms';

export type SignupFormState = {
  readonly values: SignupValues;
  readonly terms: TermsState;
  readonly emailCheck: EmailCheckState;
};

/** 버튼이 꺼진 이유 목록. 비어 있으면 켠다. 테스트와 화면 안내에 쓴다. */
export function signupBlockers(form: SignupFormState): SignupBlocker[] {
  const blockers: SignupBlocker[] = [];
  const fields = validateSignupFields(form.values);
  for (const field of Object.keys(fields) as SignupField[]) {
    if (!fields[field].valid) blockers.push(field);
  }
  const check = form.emailCheck;
  const confirmed = check.status === 'available' && check.email === normalizeEmail(form.values.email);
  if (!confirmed) blockers.push('emailCheck');
  if (!requiredTermsAgreed(form.terms)) blockers.push('requiredTerms');
  return blockers;
}

export function canSubmitSignup(form: SignupFormState): boolean {
  return signupBlockers(form).length === 0;
}
