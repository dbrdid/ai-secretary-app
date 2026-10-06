/**
 * Access 토큰 자동 갱신과 재로그인 뒤 복귀 — DTL-AUT-038, DTL-AUT-039(뒷문장). 상위 REQ-AUT-017.
 * 원문
 * - DTL-AUT-038: API가 401(토큰 만료)을 돌려주면 Refresh 토큰으로 자동 재발급한 뒤 원래 요청을 다시 보낸다. 여러 요청이
 *   동시에 만료되어도 갱신 요청은 1회만 보낸다.
 * - DTL-AUT-039: Refresh 토큰이 만료·무효면 로그인 화면으로 보내고 만료 문구를 보인다. 재로그인하면 만료 직전에 보던
 *   화면으로 돌아간다.
 *
 * 결정과 이유
 * - 갱신은 session.ts의 SessionApi.refresh를 그대로 쓴다. 재진입 복원(DTL-AUT-037)과 같은 서버 호출이고 결과 모양도 같다.
 * - '1회만': 진행 중인 갱신이 있으면 그 결과를 함께 기다린다. 또 요청이 401을 받았을 때 그 요청에 실었던 토큰이 이미
 *   바뀌어 있으면(다른 요청이 먼저 갱신을 끝냄) 갱신 없이 새 토큰으로 다시 보낸다. Refresh 토큰 회전(DTL-AUT-040) 때문에
 *   같은 토큰으로 두 번 갱신하면 서버가 재사용으로 보고 모든 세션을 끊을 수 있어서 이 경우를 꼭 막아야 한다.
 * - 다시 보낸 요청이 또 401이면 더 갱신하지 않고 세션이 끝난 것으로 본다. 무한 반복을 막는다.
 * - 토큰을 실어 보냈는데 401이 돌아온 사이에 보관함이 비었으면(다른 요청의 갱신이 만료·무효로 끝남) 다시 갱신하지 않고
 *   세션 종료로 본다. 같은 쿠키로 또 갱신하면 '1회만'이 깨진다.
 * - 세션 종료 문구는 session.ts의 screenAfterRefresh와 같다: 쿠키가 아예 없으면(noSession) 문구 없이 로그인 화면이다(OD-07).
 * - 갱신이 네트워크 오류로 실패하면 로그아웃시키지 않는다(session.ts restoreSession과 같은 [임시 가정], OD-07).
 * - 복귀할 화면은 앱 안의 경로만 받는다('/'로 시작하고 '//'로 시작하지 않는 것). 바깥 주소를 받아 주면 로그인 뒤 다른
 *   사이트로 보내는 데 쓰일 수 있다(오픈 리다이렉트). 탭·줄바꿈 같은 제어 문자가 든 경로도 받지 않는다 — 브라우저 URL 해석은
 *   이 글자들을 지우므로 '/\t/evil.com'이 '//evil.com'이 된다. 로그인·가입·재설정 화면으로는 돌아가지 않는다.
 * - [합의 필요] 앱(Flutter)의 화면 경로 이름은 웹과 다를 수 있다. 경로 문자열 규칙은 화면 담당과 맞춘다.
 */
import { SESSION_EXPIRED_MESSAGE, refreshAndStore, screenAfterRefresh, type AccessTokenHolder, type RefreshResult, type SessionApi } from './session.ts';

/** 토큰을 실어 보낸 API 응답. 401만 따로 알아야 하므로 상태 코드만 본다. */
export type ApiResponse<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly status: number };

/** 토큰을 받아 요청을 보내는 함수. 갱신 뒤 같은 요청을 다시 보내려고 함수로 받는다. */
export type ApiCall<T> = (accessToken: string | null) => Promise<ApiResponse<T>>;

export type CallOutcome<T> =
  | ApiResponse<T>
  /** 세션이 끝났다. 화면은 로그인으로 보내고 message가 있으면 보인다(DTL-AUT-039). */
  | { readonly ok: false; readonly status: 401; readonly sessionEnded: true; readonly message: string | null };

export type TokenRefresher = {
  /** 진행 중인 갱신이 있으면 그것을 기다리고, 없으면 새로 시작한다. */
  refresh(): Promise<RefreshResult>;
};

export function createTokenRefresher(api: SessionApi, tokens: AccessTokenHolder): TokenRefresher {
  let inFlight: Promise<RefreshResult> | null = null;
  return {
    refresh() {
      if (inFlight !== null) return inFlight;
      inFlight = refreshAndStore(api, tokens).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}

const sessionEnded = (message: string | null) => ({ ok: false, status: 401, sessionEnded: true, message }) as const;

function endedBy(result: Exclude<RefreshResult, { ok: true }>) {
  const outcome = screenAfterRefresh(result);
  return sessionEnded(outcome.screen === 'login' ? outcome.message : SESSION_EXPIRED_MESSAGE);
}

/** DTL-AUT-038: 요청을 보내고, 401이면 한 번 갱신해 다시 보낸다. */
export async function callWithRefresh<T>(call: ApiCall<T>, refresher: TokenRefresher, tokens: AccessTokenHolder): Promise<CallOutcome<T>> {
  const sentWith = tokens.get();
  const first = await call(sentWith);
  if (first.ok || first.status !== 401) return first;

  const latest = tokens.get();
  // 토큰을 실어 보냈는데 그사이 보관함이 비었다: 다른 요청의 갱신이 만료·무효로 끝났다.
  if (sentWith !== null && latest === null) return sessionEnded(SESSION_EXPIRED_MESSAGE);
  if (latest === sentWith) {
    // 이 요청이 갱신을 시작하거나, 이미 진행 중인 갱신을 기다린다.
    const result = await refresher.refresh();
    if (!result.ok) {
      // 네트워크 오류면 세션은 그대로 두고 원래 401을 돌려준다. 화면은 '다시 시도'를 보인다.
      return result.reason === 'network' ? first : endedBy(result);
    }
  }
  const retried = await call(tokens.get());
  if (!retried.ok && retried.status === 401) return sessionEnded(SESSION_EXPIRED_MESSAGE);
  return retried;
}

// ---------------------------------------------------------------------------------------------
// DTL-AUT-039 재로그인 뒤 복귀

/** 돌아가지 않을 화면. 로그인 뒤 다시 로그인·가입 화면이 열리면 안 된다. */
export const NO_RETURN_PREFIXES = ['/login', '/signup', '/verify', '/password-reset'] as const;

/**
 * 복귀할 경로를 고른다. 쓸 수 없는 값이면 null을 돌려주고, 화면은 로그인 후 이동 규칙(REQ-AUT-012: 홈 또는 초기 설정)을 따른다.
 */
export function safeReturnPath(path: string | null | undefined): string | null {
  if (path === null || path === undefined) return null;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;
  // 경로 부분만 비교한다('/login?next=…'도 로그인 화면이다).
  const pathname = path.split(/[?#]/)[0] ?? '';
  if (NO_RETURN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return path;
}
