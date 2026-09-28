/**
 * 회원가입 입력 검증 규칙 — DTL-AUT-003·006·008·009·011·012.
 *
 * 이 규칙들은 시트 분류가 '검증(Val)'이라 육양님 담당(기능) 밖이다. 가입 버튼 활성 조건
 * (DTL-AUT-016)을 계산하려면 있어야 해서 원문대로 옮겨 두었다. 검증 담당의 코드가 생기면
 * 그쪽으로 합치고, signupButton.ts는 그 결과를 쓰게 바꾼다.
 *
 * 원문이 정하지 않아 MyClaw가 해석한 부분에는 [해석]을 달았다(검증 담당 확인 필요).
 * 문구는 원문 그대로다. 원문에 문구가 없는 실패는 message 없이 돌려주고 화면이 정한다.
 */

export type SignupValues = {
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
  organization: string;
};

export type SignupField = keyof SignupValues;

export type FieldCheck = { readonly valid: true } | { readonly valid: false; readonly message?: string };

export const MESSAGES = {
  emailFormat: '올바른 이메일 형식이 아닙니다', // DTL-AUT-003
  passwordMismatch: '비밀번호가 일치하지 않습니다', // DTL-AUT-008
  passwordContainsEmailId: '비밀번호에 이메일 아이디를 포함할 수 없습니다', // DTL-AUT-009
  name: '이름은 2~20자의 한글 또는 영문으로 입력해 주세요', // DTL-AUT-011
  organizationRequired: '소속(회사명)을 입력해 주세요', // DTL-AUT-012
} as const;

const OK: FieldCheck = { valid: true };

/** 글자 수는 코드 포인트로 센다(이모지 같은 글자를 2자로 세지 않게). */
function charCount(text: string): number {
  return Array.from(text).length;
}

/** DTL-AUT-003: 앞뒤 공백 제거 후 소문자로 바꾼다. 중복 확인(DTL-AUT-004)도 이 값으로 한다. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * DTL-AUT-003: 최대 254자, '아이디@도메인.최상위도메인' 형식.
 * [해석] 형식은 "@ 앞뒤가 비어 있지 않고, 도메인에 점으로 나뉜 빈칸 없는 부분이 둘 이상"으로 본다.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function checkEmail(raw: string): FieldCheck {
  const email = normalizeEmail(raw);
  if (email === '') return { valid: false };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { valid: false, message: MESSAGES.emailFormat };
  return OK;
}

/**
 * [해석] 특수문자는 ASCII 기호 32자로 본다. 원문은 범위를 정하지 않았다.
 * 영문·숫자·기호가 아닌 글자(한글 등)는 원문이 막지 않아 허용한다.
 */
const SPECIAL_CHARS = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/** DTL-AUT-007 체크리스트의 네 항목. 조건 자체는 DTL-AUT-006에서 온다. */
export function passwordChecklist(password: string) {
  return {
    minLength: charCount(password) >= 8,
    hasLetter: /[A-Za-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: SPECIAL_CHARS.test(password),
  };
}

/**
 * DTL-AUT-006(8~64자, 영문·숫자·특수문자 각 1개 이상, 공백 불가)과
 * DTL-AUT-009(이메일 @ 앞부분이 4자 이상이고 그 문자열이 비밀번호에 들어 있으면 거부).
 * [해석] DTL-AUT-009는 정규화(소문자)한 아이디가 비밀번호에 글자 그대로 들어 있는지 본다.
 * 대소문자를 무시할지는 원문에 없다.
 */
export function checkPassword(password: string, rawEmail: string): FieldCheck {
  const list = passwordChecklist(password);
  const complex =
    list.minLength && charCount(password) <= 64 && list.hasLetter && list.hasDigit && list.hasSpecial && !/\s/.test(password);
  if (!complex) return { valid: false };

  const email = normalizeEmail(rawEmail);
  const at = email.indexOf('@');
  const emailId = at > 0 ? email.slice(0, at) : '';
  if (charCount(emailId) >= 4 && password.includes(emailId)) {
    return { valid: false, message: MESSAGES.passwordContainsEmailId };
  }
  return OK;
}

/** DTL-AUT-008. 확인칸이 비어 있으면 아직 입력 전으로 보고 문구를 붙이지 않는다. */
export function checkPasswordConfirm(password: string, confirm: string): FieldCheck {
  if (confirm === '') return { valid: false };
  return confirm === password ? OK : { valid: false, message: MESSAGES.passwordMismatch };
}

/**
 * DTL-AUT-011: 앞뒤 공백 제거 후 2~20자, 한글/영문/공백만.
 * [해석] 한글은 완성형 음절(가~힣)만, 공백은 일반 공백(U+0020)만 인정한다.
 */
export function checkName(raw: string): FieldCheck {
  const name = raw.trim();
  const length = charCount(name);
  if (length >= 2 && length <= 20 && /^[가-힣A-Za-z ]+$/.test(name)) return OK;
  return { valid: false, message: MESSAGES.name };
}

/**
 * DTL-AUT-012: 필수, 1~50자.
 * [해석] 공백만 입력한 경우도 비어 있는 것으로 본다(앞뒤 공백을 빼고 센다).
 * 50자를 넘을 때의 문구는 원문에 없다.
 */
export function checkOrganization(raw: string): FieldCheck {
  const organization = raw.trim();
  if (organization === '') return { valid: false, message: MESSAGES.organizationRequired };
  return charCount(organization) <= 50 ? OK : { valid: false };
}

export function validateSignupFields(values: SignupValues): Record<SignupField, FieldCheck> {
  return {
    email: checkEmail(values.email),
    password: checkPassword(values.password, values.email),
    passwordConfirm: checkPasswordConfirm(values.password, values.passwordConfirm),
    name: checkName(values.name),
    organization: checkOrganization(values.organization),
  };
}
