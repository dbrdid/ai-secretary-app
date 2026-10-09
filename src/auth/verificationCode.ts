/**
 * 이메일 인증번호 — DTL-AUT-021~026(가입 인증), DTL-AUT-046~048·052(비밀번호 재설정). 상위 REQ-AUT-007~009·022·025·033.
 * 원문
 * - DTL-AUT-021: 6자리 숫자 입력칸, 남은 시간 타이머(03:00), [재발송], [이메일 변경].
 * - DTL-AUT-022: 6자리 숫자 인증번호, 3분간 유효. 새 인증번호를 보내면 이전 것은 즉시 무효.
 * - DTL-AUT-023: 숫자만 입력, 붙여넣기 지원, 6자리를 모두 넣으면 자동 제출.
 * - DTL-AUT-024: 틀리면 "인증번호가 올바르지 않습니다 (남은 시도 X회)". 5회 틀리면 그 인증번호를 무효로 하고 재발송을 요구.
 * - DTL-AUT-025: 타이머가 00:00이 되면 입력칸을 끄고 만료 문구.
 * - DTL-AUT-026: [재발송] 60초 대기(shared/cooldown.ts)와 1시간 최대 5회.
 * - DTL-AUT-047: 재설정 인증번호는 1회용이고 유효 시간·실패 처리·재발송 제한은 가입 인증과 같다.
 *
 * 화면 쪽(입력 정리·자동 제출·타이머)과 서버 쪽(발급·대조·재발송 횟수)을 한 파일에 둔다. 두 쪽이 같은 수치를 써야
 * 화면 타이머가 00:00인데 서버는 받아 주는 어긋남이 생기지 않는다.
 *
 * 결정과 이유
 * - 시각은 밀리초 숫자로 받는다. 서버는 Date.now(), 화면 타이머는 서버가 알려 준 만료 시각까지 남은 시간을 받아
 *   performance.now() 기준으로 센다(shared/cooldown.ts와 같은 이유: 기기 시각을 바꿔도 튀지 않게).
 * - 난수는 주입받는다. 서버는 node:crypto의 randomInt처럼 암호학적으로 안전한 함수를 넘긴다. Math.random은 다음 값을
 *   추측할 수 있어 쓰지 않는다. 이 파일이 node:crypto를 직접 부르지 않는 것은 웹에서도 같은 파일을 쓰기 위해서다.
 * - 만료와 5회 실패는 맞는 번호를 넣어도 실패로 본다. 만료 뒤에 맞히는 것을 허용하면 3분 제한이 의미가 없다.
 * - 한 번 맞힌 인증번호는 다시 쓸 수 없다(DTL-AUT-047 1회용). 가입 인증에도 똑같이 적용한다 — 이미 활성화된
 *   계정에 같은 번호로 또 요청이 오는 것은 정상 흐름이 아니다.
 * - [해석] '1시간 최대 5회'는 그 이메일로 보낸 모든 발송을 센다. 가입 직후 자동 발송(DTL-AUT-022)과 미인증 로그인 때의
 *   자동 발송(DTL-AUT-028)도 넣는다. 자동 발송을 빼면 미인증 계정에 로그인을 되풀이해 새 인증번호(그때마다 5번의 추측)와
 *   메일을 끝없이 받을 수 있다. 막혔을 때 자동 발송은 보내지 않고, 인증 화면은 직전 인증번호를 그대로 쓴다.
 *   1시간은 마지막 1시간(움직이는 창)이다.
 * - [합의 필요] 서버에서 대조할 때 글자 비교 시간이 드러나지 않게 하는 처리(timingSafeEqual)는 서버 담당이 붙인다.
 *   6자리·5회 제한이라 위험은 작지만 서버 코드에서는 쓰는 것이 관례다.
 */

export const CODE_LENGTH = 6; // DTL-AUT-022
export const CODE_VALID_MS = 3 * 60_000; // DTL-AUT-021·022 (10/4 스토리보드 S9·S10 기준 3분)
export const MAX_WRONG_ATTEMPTS = 5; // DTL-AUT-024
export const RESEND_LIMIT = 5; // DTL-AUT-026
export const RESEND_WINDOW_MS = 60 * 60_000; // DTL-AUT-026 1시간

export const CODE_MESSAGES = {
  /** DTL-AUT-021 안내 문구. 화면이 이메일을 넣는다. */
  sent: (email: string) => `${email}로 인증번호를 보냈습니다`,
  /** DTL-AUT-024 */
  wrong: (remaining: number) => `인증번호가 올바르지 않습니다 (남은 시도 ${remaining}회)`,
  /** DTL-AUT-025 */
  expired: '인증 시간이 만료되었습니다. 인증번호를 재발송해 주세요',
  /** DTL-AUT-052 (재설정) */
  resetExpiredOrUsed: '인증번호가 만료되었거나 이미 사용되었습니다',
  /** DTL-AUT-048 (재설정, 가입 여부와 관계없이 같은 문구) */
  resetSent: '입력하신 이메일로 가입된 계정이 있다면 인증번호를 보냈습니다',
} as const;

// ---------------------------------------------------------------------------------------------
// 화면 쪽

/**
 * DTL-AUT-023: 입력칸에 들어온 글자에서 숫자만 남기고 6자리까지 자른다. 붙여넣기('123 456', '123-456')도 이것으로 정리한다.
 * 전각 숫자(１２３)는 숫자로 보지 않는다 — 서버가 받는 값은 ASCII 숫자다.
 */
export function sanitizeCodeInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
}

/** DTL-AUT-023: 6자리를 모두 넣었으면 자동 제출한다. 정리된 값(sanitizeCodeInput 결과)을 넘긴다. */
export function shouldAutoSubmit(code: string): boolean {
  return code.length === CODE_LENGTH && /^[0-9]+$/.test(code);
}

/** 남은 밀리초. 만료 시각이 지났으면 0. */
export function remainingMs(expiresAt: number, now: number): number {
  return Math.max(0, expiresAt - now);
}

/**
 * DTL-AUT-021 타이머 표시 'MM:SS'. 초 아래는 올린다 — 발송 직후 03:00, 마지막 1초 동안 00:01, 만료 순간 00:00.
 * 내림으로 하면 1초가 남았는데 00:00이 보여 사용자가 만료로 오해한다.
 */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** DTL-AUT-025: 타이머가 00:00이면 입력칸을 끈다. */
export function isInputDisabled(expiresAt: number, now: number): boolean {
  return remainingMs(expiresAt, now) === 0;
}

// ---------------------------------------------------------------------------------------------
// 서버 쪽

export type IssuedCode = {
  readonly code: string;
  readonly expiresAt: number;
  readonly wrongAttempts: number;
  readonly used: boolean;
};

/** 0 이상 max 미만의 정수를 돌려주는 안전한 난수 함수. 서버는 node:crypto의 randomInt를 넘긴다. */
export type RandomInt = (max: number) => number;

/** DTL-AUT-022: 6자리 숫자를 만든다. 앞자리 0도 허용한다('012345'). */
export function generateCode(randomInt: RandomInt): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const digit = randomInt(10);
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) throw new RangeError(`randomInt(10)이 0~9가 아님: ${digit}`);
    code += String(digit);
  }
  return code;
}

/**
 * DTL-AUT-022: 새 인증번호를 발급한다. 이전 번호를 무효로 하는 것은 저장할 때 이 값으로 덮어쓰는 것이다 —
 * 이메일마다 하나만 보관하면 이전 번호는 저절로 맞지 않게 된다.
 */
export function issueCode(randomInt: RandomInt, now: number): IssuedCode {
  return { code: generateCode(randomInt), expiresAt: now + CODE_VALID_MS, wrongAttempts: 0, used: false };
}

export type VerifyResult =
  | { readonly status: 'ok' }
  /** 틀렸고 아직 더 시도할 수 있다. remaining은 남은 횟수(1 이상). */
  | { readonly status: 'wrong'; readonly remaining: number; readonly message: string }
  /** 5회 틀려 무효가 됐다. 재발송해야 한다(DTL-AUT-024). 이번 시도로 5회가 된 경우도 여기다. */
  | { readonly status: 'locked'; readonly message: string }
  | { readonly status: 'expired'; readonly message: string }
  /** 이미 한 번 맞힌 번호(DTL-AUT-047·052). 가입 인증 화면은 expired와 같은 문구를 보여도 된다. */
  | { readonly status: 'used'; readonly message: string };

/**
 * 입력을 대조하고 다음 상태를 돌려준다. 서버는 돌려받은 state를 저장한다(실패 횟수·사용 여부가 바뀐다).
 * 입력은 sanitizeCodeInput을 거친 값이 아니어도 된다 — 서버는 화면을 믿지 않고 다시 정리한다.
 */
export function verifyCode(issued: IssuedCode, input: string, now: number): { readonly result: VerifyResult; readonly state: IssuedCode } {
  if (issued.used) return { result: { status: 'used', message: CODE_MESSAGES.resetExpiredOrUsed }, state: issued };
  if (now >= issued.expiresAt) return { result: { status: 'expired', message: CODE_MESSAGES.expired }, state: issued };
  if (issued.wrongAttempts >= MAX_WRONG_ATTEMPTS) return { result: lockedResult(), state: issued };

  const cleaned = sanitizeCodeInput(input);
  if (cleaned.length === CODE_LENGTH && cleaned === issued.code) {
    return { result: { status: 'ok' }, state: { ...issued, used: true } };
  }
  const wrongAttempts = issued.wrongAttempts + 1;
  const state = { ...issued, wrongAttempts };
  const remaining = MAX_WRONG_ATTEMPTS - wrongAttempts;
  if (remaining <= 0) return { result: lockedResult(), state };
  return { result: { status: 'wrong', remaining, message: CODE_MESSAGES.wrong(remaining) }, state };
}

// 원문(DTL-AUT-024)은 5회째의 문구를 따로 정하지 않았다. 재발송을 요구한다는 뜻이 같은 만료 문구를 쓴다.
const lockedResult = (): VerifyResult => ({ status: 'locked', message: CODE_MESSAGES.expired });

/**
 * DTL-AUT-026 '1시간 최대 5회'. 발송하기 전에(자동 발송 포함) 부른다. history는 이 이메일로 보낸 시각들이다(1시간이 지난
 * 것은 저장소가 지워도 된다). 받아 주면 now를 더한 history를 돌려주고, 넘었으면 다음에 가능한 시각을 돌려준다.
 */
export function tryResend(
  history: readonly number[],
  now: number,
): { readonly allowed: true; readonly history: readonly number[] } | { readonly allowed: false; readonly retryAt: number } {
  const recent = history.filter((t) => t > now - RESEND_WINDOW_MS).sort((a, b) => a - b);
  if (recent.length < RESEND_LIMIT) return { allowed: true, history: [...recent, now] };
  // 가장 오래된 기록이 1시간 창 밖으로 나가는 순간 다시 가능하다.
  return { allowed: false, retryAt: (recent[recent.length - RESEND_LIMIT] as number) + RESEND_WINDOW_MS };
}
