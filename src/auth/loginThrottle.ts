/**
 * 로그인 입력 검사와 연속 실패 차단 — DTL-AUT-031(입력 사전 검사), DTL-AUT-033(통일 메시지), DTL-AUT-034(연속 실패 차단).
 * 상위 REQ-AUT-011·013·014·035.
 * 원문
 * - DTL-AUT-031: 이메일 또는 비밀번호가 비어 있으면 API를 부르지 않고 "이메일을 입력해 주세요" 또는 "비밀번호를 입력해
 *   주세요". 로그인 화면에서는 비밀번호 복잡도를 검사하지 않는다.
 * - DTL-AUT-033: 이메일이 없거나 비밀번호가 틀린 경우 모두 "이메일 또는 비밀번호가 일치하지 않습니다". 비밀번호 칸만 비운다.
 * - DTL-AUT-034: 같은 이메일로 5회 연속 실패하면 10분간 차단하고 "로그인 시도 횟수를 초과했습니다. 10분 후 다시 시도해
 *   주세요". 가입되지 않은 이메일에도 똑같이 적용한다. 로그인에 성공하면 실패 횟수를 0으로 되돌린다.
 *
 * 결정과 이유
 * - 차단 판단은 서버 몫이다(화면의 제한은 새로고침이나 다른 기기로 우회된다). 이 파일의 throttle 함수는 서버가 이메일마다
 *   저장한 상태를 받아 다음 상태를 돌려주는 순수 함수다. 저장 위치(DB·Redis 등)는 서버 담당이 정한다.
 * - 열쇠는 정리한 이메일(signupRules.normalizeEmail)이다. 'Kim@x.com'과 'kim@x.com'을 다른 계정으로 세면 대소문자만
 *   바꿔 5회 제한을 피할 수 있다.
 * - 차단 중에 들어온 시도는 비밀번호를 대조하지 않고 막는다. 대조하면 차단 중에도 맞는 비밀번호를 찾아낼 수 있다.
 *   차단 중 시도는 실패 횟수를 늘리지 않고 차단 시간도 늘리지 않는다(원문은 '10분간'만 적었다).
 * - [해석] 10분이 지나면 실패 횟수를 0부터 다시 센다. 원문의 '연속 5회'를 차단 한 번으로 소진된 것으로 본다.
 */
import { normalizeEmail } from './signupRules.ts';

export const MAX_LOGIN_FAILURES = 5; // DTL-AUT-034
export const LOGIN_BLOCK_MS = 10 * 60_000; // DTL-AUT-034 (10/4 스토리보드 S4 기준 10분)

export const LOGIN_MESSAGES = {
  emailRequired: '이메일을 입력해 주세요', // DTL-AUT-031
  passwordRequired: '비밀번호를 입력해 주세요', // DTL-AUT-031
  mismatch: '이메일 또는 비밀번호가 일치하지 않습니다', // DTL-AUT-033
  blocked: '로그인 시도 횟수를 초과했습니다. 10분 후 다시 시도해 주세요', // DTL-AUT-034
} as const;

export type LoginFieldError = { readonly field: 'email' | 'password'; readonly message: string };

/**
 * DTL-AUT-031: 빈 칸 검사. 비어 있으면 API를 부르지 않는다. 둘 다 비었으면 둘 다 알린다(위 칸부터).
 * 공백만 넣은 이메일은 빈 것으로 본다. 비밀번호는 공백도 글자일 수 있지만 가입 규칙(DTL-AUT-006)이 공백을 막으므로
 * 공백만 있는 비밀번호도 빈 것으로 본다.
 */
export function checkLoginInput(email: string, password: string): readonly LoginFieldError[] {
  const errors: LoginFieldError[] = [];
  if (email.trim() === '') errors.push({ field: 'email', message: LOGIN_MESSAGES.emailRequired });
  if (password.trim() === '') errors.push({ field: 'password', message: LOGIN_MESSAGES.passwordRequired });
  return errors;
}

/** 서버가 이메일마다 저장하는 값. 처음 보는 이메일은 LOGIN_THROTTLE_CLEAR. */
export type LoginThrottle = { readonly failures: number; readonly blockedUntil: number | null };

export const LOGIN_THROTTLE_CLEAR: LoginThrottle = { failures: 0, blockedUntil: null };

/** 저장 열쇠. 가입 여부와 관계없이 같은 열쇠를 만든다. */
export function throttleKey(email: string): string {
  return normalizeEmail(email);
}

export type LoginGate =
  | { readonly allowed: true }
  /** retryAt: 다시 시도할 수 있는 시각(REQ-AUT-035 '다시 시도할 수 있는 시점'). */
  | { readonly allowed: false; readonly retryAt: number; readonly message: string };

/** 비밀번호를 대조하기 전에 부른다. 막혔으면 대조하지 않는다. */
export function checkLoginGate(state: LoginThrottle, now: number): LoginGate {
  if (state.blockedUntil !== null && now < state.blockedUntil) {
    return { allowed: false, retryAt: state.blockedUntil, message: LOGIN_MESSAGES.blocked };
  }
  return { allowed: true };
}

/** 차단 시간이 지난 상태는 처음부터 센다. */
function current(state: LoginThrottle, now: number): LoginThrottle {
  return state.blockedUntil !== null && now >= state.blockedUntil ? LOGIN_THROTTLE_CLEAR : state;
}

/**
 * 대조 결과를 반영한다. 가입되지 않은 이메일은 success=false로 부른다(DTL-AUT-034 '동일하게 적용').
 * 돌려주는 message는 화면에 그대로 보인다 — 5회째 실패면 차단 문구, 그 전이면 통일 문구다.
 */
export function recordLoginAttempt(
  state: LoginThrottle,
  success: boolean,
  now: number,
): { readonly state: LoginThrottle; readonly message: string | null } {
  if (success) return { state: LOGIN_THROTTLE_CLEAR, message: null };
  const base = current(state, now);
  const failures = base.failures + 1;
  if (failures >= MAX_LOGIN_FAILURES) {
    return { state: { failures, blockedUntil: now + LOGIN_BLOCK_MS }, message: LOGIN_MESSAGES.blocked };
  }
  return { state: { failures, blockedUntil: null }, message: LOGIN_MESSAGES.mismatch };
}
