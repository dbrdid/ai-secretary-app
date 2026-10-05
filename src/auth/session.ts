/**
 * 로그인 유지와 세션 복원 — DTL-AUT-035(로그인 유지), DTL-AUT-037(자동 로그인·세션 복원). 상위 REQ-AUT-015.
 * 원문
 * - DTL-AUT-035: [로그인 유지]를 체크하면 Refresh 토큰을 14일간 유지하고, 체크하지 않으면 브라우저를 종료할 때 세션을
 *   종료한다. 기본값은 미체크이다.
 * - DTL-AUT-037: 페이지에 재진입할 때 유효한 Refresh 토큰이 있으면 로그인 화면 없이 Access 토큰을 재발급받아 홈으로
 *   진입한다. 복원하는 동안에는 스플래시 로딩 화면을 표시한다.
 * 함께 지키는 원문: DTL-AUT-036(Refresh 토큰은 HttpOnly·Secure·SameSite 쿠키, Access 토큰은 메모리에만, localStorage 금지),
 * DTL-AUT-032(온보딩을 마치지 않았으면 초기 설정으로), DTL-AUT-039(만료 문구).
 *
 * 나눈 몫
 * - 웹 화면은 HttpOnly 쿠키를 읽지 못한다. 그래서 화면은 로그인 요청에 keepLoggedIn만 싣고, 쿠키를 굽는 일(14일 쿠키 또는
 *   브라우저를 닫으면 사라지는 세션 쿠키)은 서버가 한다. refreshCookiePolicy는 서버와 가짜 서버가 같은 규칙을 쓰게 둔 것이다.
 * - 화면은 재진입할 때 restoreSession을 부르고, 끝날 때까지 스플래시를 보인 뒤 돌려받은 화면으로 간다.
 *
 * 결정과 이유
 * - 비밀번호는 어디에도 저장하지 않는다. 스토리보드는 'Remember'를 "이메일과 비밀번호 자동 저장"으로 적었지만 상세 설계는
 *   토큰 방식이다(DTL-AUT-035·036). 비밀번호를 기기에 두면 기기가 털렸을 때 비밀번호까지 새고, 비밀번호를 바꿔도 그
 *   기기의 자동 로그인을 막을 수 없다(docs/open-decisions.md OD-07).
 * - Access 토큰은 메모리 보관함에만 둔다(DTL-AUT-036). 새로고침하면 사라지므로 재진입할 때마다 refresh로 다시 받는다.
 * - 만료 문구(DTL-AUT-039)는 서버가 만료·폐기라고 알려 줄 때만 띄운다. 처음 온 사람에게 "로그인이 만료되었습니다"를
 *   보이지 않으려는 것이다. 14일이 지나면 브라우저가 쿠키를 지워 서버도 처음 온 사람과 구분하지 못하므로, 그때는 문구 없이
 *   로그인 화면이 된다(OD-07).
 * - [임시 가정] 네트워크 오류로 복원하지 못하면 로그아웃시키지 않고 '다시 시도'로 둔다. 잠깐 끊겼다고 로그인 화면으로
 *   보내면 로그인 유지를 고른 사람도 다시 로그인해야 한다. 원문에 없다(OD-07).
 * - 복원 뒤 갈 곳은 온보딩을 마쳤으면 홈, 아니면 초기 설정이다. DTL-AUT-037 원문은 '홈'만 적었지만 로그인(DTL-AUT-032)과
 *   같은 규칙을 써야 초기 설정을 건너뛰지 않는다(REQ-SET-003).
 */

/** DTL-AUT-035 원문 값. [합의 필요] 로그인 때부터 세는지, 재발급할 때마다 다시 세는지는 원문에 없다(OD-07). */
export const KEEP_LOGGED_IN_DAYS = 14;

/** DTL-AUT-035: [로그인 유지] 기본값은 미체크 */
export const KEEP_LOGGED_IN_DEFAULT = false;

/** DTL-AUT-039 원문 문구 */
export const SESSION_EXPIRED_MESSAGE = '로그인이 만료되었습니다. 다시 로그인해 주세요';

const DAY_SECONDS = 24 * 60 * 60;

/**
 * 서버가 Refresh 토큰 쿠키를 굽는 규칙. persistent=false는 Max-Age·Expires가 없는 세션 쿠키로, 브라우저를 닫으면 사라진다.
 * 쿠키 속성(HttpOnly·Secure·SameSite, DTL-AUT-036)은 어느 쪽이든 늘 붙으므로 여기서 다루지 않는다.
 */
export type RefreshCookiePolicy =
  | { readonly persistent: true; readonly maxAgeSeconds: number }
  | { readonly persistent: false };

export function refreshCookiePolicy(keepLoggedIn: boolean, keepDays: number = KEEP_LOGGED_IN_DAYS): RefreshCookiePolicy {
  return keepLoggedIn ? { persistent: true, maxAgeSeconds: keepDays * DAY_SECONDS } : { persistent: false };
}

/** 로그인 요청 본문. 비밀번호는 요청에만 실리고 저장하지 않는다. */
export type LoginRequest = { readonly email: string; readonly password: string; readonly keepLoggedIn: boolean };

/**
 * 재발급 결과. 실패 이유
 * - noSession: 쿠키가 없다(처음 왔거나, 미체크로 로그인한 뒤 브라우저를 닫았거나, 14일이 지나 브라우저가 지웠다).
 * - expired: 서버 쪽 수명이 끝났다. invalid: 폐기된 토큰이다(비밀번호 변경 DTL-AUT-053, 재사용 탐지 DTL-AUT-040 등).
 * - network: 서버에 닿지 못했다.
 * [합의 필요] 서버가 이렇게 나눠 알려 줄지는 API 담당과 정한다(OD-03·OD-07).
 */
export type RefreshResult =
  | { readonly ok: true; readonly accessToken: string; readonly onboardingCompleted: boolean }
  | { readonly ok: false; readonly reason: 'noSession' | 'expired' | 'invalid' | 'network' };

export type SessionApi = {
  /** 쿠키의 Refresh 토큰으로 Access 토큰을 다시 받는다. 웹에서는 쿠키가 요청에 저절로 실린다. */
  refresh(): Promise<RefreshResult>;
};

/** Access 토큰 보관함. 메모리에만 둔다(DTL-AUT-036) — localStorage·쿠키에 쓰지 않는다. */
export type AccessTokenHolder = {
  get(): string | null;
  set(token: string): void;
  clear(): void;
};

export function createAccessTokenHolder(): AccessTokenHolder {
  let token: string | null = null;
  return {
    get: () => token,
    set: (next) => {
      token = next;
    },
    clear: () => {
      token = null;
    },
  };
}

/** 복원이 끝난 뒤 갈 화면. 복원하는 동안(restoreSession이 끝나기 전)은 스플래시를 보인다. */
export type RestoreOutcome =
  | { readonly screen: 'home' }
  | { readonly screen: 'onboarding' }
  | { readonly screen: 'login'; readonly message: string | null }
  | { readonly screen: 'retry' };

export function screenAfterRefresh(result: RefreshResult): RestoreOutcome {
  if (result.ok) return result.onboardingCompleted ? { screen: 'home' } : { screen: 'onboarding' };
  switch (result.reason) {
    case 'network':
      return { screen: 'retry' };
    case 'noSession':
      return { screen: 'login', message: null };
    case 'expired':
    case 'invalid':
      return { screen: 'login', message: SESSION_EXPIRED_MESSAGE };
  }
}

/** DTL-AUT-037: 재진입할 때 부른다. 성공하면 Access 토큰을 보관함에 넣고, 세션이 없거나 끝났으면 비운다. */
export async function restoreSession(api: SessionApi, tokens: AccessTokenHolder): Promise<RestoreOutcome> {
  let result: RefreshResult;
  try {
    result = await api.refresh();
  } catch {
    // fetch가 던지는 경우(오프라인, DNS 실패 등)도 네트워크 오류로 본다.
    result = { ok: false, reason: 'network' };
  }
  if (result.ok) tokens.set(result.accessToken);
  else if (result.reason !== 'network') tokens.clear();
  return screenAfterRefresh(result);
}
