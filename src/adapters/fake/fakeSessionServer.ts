/**
 * 로그인 유지·세션 복원을 시험하는 가짜 서버와 브라우저 쿠키 — src/auth/session.ts 테스트용.
 * 실제 서버·브라우저 검증이 아니다. 실제 쿠키 동작(세션 쿠키는 브라우저를 닫으면 사라지고, Max-Age가 지나면 브라우저가
 * 지운다)을 흉내 내 DTL-AUT-035·037 흐름을 처음부터 끝까지 돌려 보려는 것이다.
 *
 * [임시 가정] 서버 쪽 토큰 수명은 로그인 때부터 14일이고, 재발급(회전, DTL-AUT-040)해도 늘지 않는다. 미체크 로그인도
 * 서버 쪽 수명은 같게 두고 브라우저를 닫을 때 쿠키만 사라지게 했다(docs/open-decisions.md OD-07).
 */
import { KEEP_LOGGED_IN_DAYS, refreshCookiePolicy, type LoginRequest, type RefreshResult, type SessionApi } from '../../auth/session.ts';

type Account = { readonly password: string; readonly onboardingCompleted: boolean };
type ServerToken = { readonly email: string; readonly expiresAt: number; revoked: boolean };
/** expiresAt이 null이면 세션 쿠키 */
type BrowserCookie = { readonly token: string; readonly expiresAt: number | null };

const DAY_MS = 24 * 60 * 60 * 1000;

export type FakeSessionServer = SessionApi & {
  login(request: LoginRequest): Promise<{ readonly ok: true; readonly accessToken: string } | { readonly ok: false }>;
  /** 브라우저를 닫는다: 세션 쿠키가 사라진다. */
  closeBrowser(): void;
  setOffline(offline: boolean): void;
  /** 그 사람의 모든 세션을 폐기한다(예: 다른 기기에서 비밀번호 변경, DTL-AUT-053). */
  revokeAll(email: string): void;
  /** 브라우저에 보낼 쿠키가 남아 있는지 */
  hasCookie(): boolean;
};

export function createFakeSessionServer(options: {
  readonly now: () => number;
  readonly accounts: Readonly<Record<string, Account>>;
}): FakeSessionServer {
  const tokens = new Map<string, ServerToken>();
  let cookie: BrowserCookie | null = null;
  let offline = false;
  let seq = 0;
  const issue = (prefix: string) => `${prefix}-${++seq}`;

  // 브라우저는 Max-Age가 지난 쿠키를 보내지 않고 지운다.
  const liveCookie = (): BrowserCookie | null => {
    if (cookie !== null && cookie.expiresAt !== null && options.now() >= cookie.expiresAt) cookie = null;
    return cookie;
  };

  return {
    async login({ email, password, keepLoggedIn }) {
      const account = options.accounts[email];
      if (account === undefined || account.password !== password) return { ok: false };
      const now = options.now();
      const token = issue('refresh');
      tokens.set(token, { email, expiresAt: now + KEEP_LOGGED_IN_DAYS * DAY_MS, revoked: false });
      const policy = refreshCookiePolicy(keepLoggedIn);
      cookie = { token, expiresAt: policy.persistent ? now + policy.maxAgeSeconds * 1000 : null };
      return { ok: true, accessToken: issue('access') };
    },

    async refresh(): Promise<RefreshResult> {
      if (offline) return { ok: false, reason: 'network' };
      const current = liveCookie();
      if (current === null) return { ok: false, reason: 'noSession' };
      const stored = tokens.get(current.token);
      if (stored === undefined || stored.revoked) {
        cookie = null; // 서버가 쿠키를 지우라고 응답한다
        return { ok: false, reason: 'invalid' };
      }
      if (options.now() >= stored.expiresAt) {
        cookie = null;
        return { ok: false, reason: 'expired' };
      }
      // 회전(DTL-AUT-040): 새 토큰을 주고 옛 토큰은 폐기한다. 만료 시각과 쿠키 종류는 그대로 둔다([임시 가정]).
      stored.revoked = true;
      const next = issue('refresh');
      tokens.set(next, { email: stored.email, expiresAt: stored.expiresAt, revoked: false });
      cookie = { token: next, expiresAt: current.expiresAt };
      const account = options.accounts[stored.email];
      return { ok: true, accessToken: issue('access'), onboardingCompleted: account?.onboardingCompleted ?? false };
    },

    closeBrowser() {
      if (cookie !== null && cookie.expiresAt === null) cookie = null;
    },

    setOffline(value) {
      offline = value;
    },

    revokeAll(email) {
      for (const token of tokens.values()) if (token.email === email) token.revoked = true;
    },

    hasCookie: () => liveCookie() !== null,
  };
}
