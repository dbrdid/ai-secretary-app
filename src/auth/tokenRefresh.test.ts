import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_EXPIRED_MESSAGE, createAccessTokenHolder, type RefreshResult } from './session.ts';
import { callWithRefresh, createTokenRefresher, safeReturnPath, type ApiCall } from './tokenRefresh.ts';

/** 갱신 요청이 몇 번 왔는지 세고, 끝내는 시점을 테스트가 정하는 가짜 서버. */
function fakeRefreshApi(results: RefreshResult[]) {
  let calls = 0;
  const pending: Array<() => void> = [];
  return {
    get calls() {
      return calls;
    },
    /** 기다리는 갱신을 모두 끝낸다. */
    releaseAll() {
      while (pending.length > 0) pending.shift()?.();
    },
    api: {
      refresh(): Promise<RefreshResult> {
        const result = results[calls] ?? { ok: false, reason: 'invalid' };
        calls += 1;
        return new Promise((resolve) => pending.push(() => resolve(result)));
      },
    },
  };
}

/** 'valid-토큰'만 받아 주는 API. */
const protectedCall =
  (valid: () => string): ApiCall<string> =>
  async (token) =>
    token === valid() ? { ok: true, value: `data(${token})` } : { ok: false, status: 401 };

describe('DTL-AUT-038 Access 토큰 자동 갱신', () => {
  test('401이면 갱신하고 원래 요청을 다시 보낸다', async () => {
    const tokens = createAccessTokenHolder();
    tokens.set('old');
    const server = fakeRefreshApi([{ ok: true, accessToken: 'new', onboardingCompleted: true }]);
    const refresher = createTokenRefresher(server.api, tokens);
    const pending = callWithRefresh(protectedCall(() => 'new'), refresher, tokens);
    await new Promise((r) => setImmediate(r));
    server.releaseAll();
    assert.deepEqual(await pending, { ok: true, value: 'data(new)' });
    assert.equal(server.calls, 1);
  });

  test('여러 요청이 동시에 만료돼도 갱신은 한 번만 보낸다', async () => {
    const tokens = createAccessTokenHolder();
    tokens.set('old');
    const server = fakeRefreshApi([{ ok: true, accessToken: 'new', onboardingCompleted: true }]);
    const refresher = createTokenRefresher(server.api, tokens);
    const calls = [1, 2, 3].map(() => callWithRefresh(protectedCall(() => 'new'), refresher, tokens));
    await new Promise((r) => setImmediate(r));
    server.releaseAll();
    const results = await Promise.all(calls);
    assert.equal(server.calls, 1);
    assert.ok(results.every((r) => r.ok));
  });

  test('다른 요청이 이미 갱신을 끝낸 뒤 늦게 401을 받은 요청은 다시 갱신하지 않는다(토큰 회전 보호)', async () => {
    const tokens = createAccessTokenHolder();
    tokens.set('old');
    const server = fakeRefreshApi([{ ok: true, accessToken: 'new', onboardingCompleted: true }]);
    const refresher = createTokenRefresher(server.api, tokens);
    let releaseSlow: () => void = () => {};
    // 'old'로 보냈지만 응답이 늦게 오는 요청
    const slowCall: ApiCall<string> = (token) =>
      token === 'old'
        ? new Promise((resolve) => {
            releaseSlow = () => resolve({ ok: false, status: 401 });
          })
        : Promise.resolve(token === 'new' ? { ok: true, value: 'late-ok' } : { ok: false, status: 401 });
    const slow = callWithRefresh(slowCall, refresher, tokens);
    const fast = callWithRefresh(protectedCall(() => 'new'), refresher, tokens);
    await new Promise((r) => setImmediate(r));
    server.releaseAll();
    await fast;
    releaseSlow();
    assert.deepEqual(await slow, { ok: true, value: 'late-ok' });
    assert.equal(server.calls, 1);
  });

  test('갱신이 만료·무효면 세션이 끝났다고 알리고 토큰을 비운다(DTL-AUT-039)', async () => {
    const tokens = createAccessTokenHolder();
    tokens.set('old');
    const server = fakeRefreshApi([{ ok: false, reason: 'expired' }]);
    const refresher = createTokenRefresher(server.api, tokens);
    const pending = callWithRefresh(protectedCall(() => 'never'), refresher, tokens);
    await new Promise((r) => setImmediate(r));
    server.releaseAll();
    assert.deepEqual(await pending, { ok: false, status: 401, sessionEnded: true, message: SESSION_EXPIRED_MESSAGE });
    assert.equal(tokens.get(), null);
  });

  test('갱신이 네트워크 오류면 로그아웃시키지 않는다', async () => {
    const tokens = createAccessTokenHolder();
    tokens.set('old');
    const refresher = createTokenRefresher({ refresh: () => Promise.reject(new Error('offline')) }, tokens);
    const result = await callWithRefresh(protectedCall(() => 'never'), refresher, tokens);
    assert.deepEqual(result, { ok: false, status: 401 });
    assert.equal(tokens.get(), 'old');
  });

  test('갱신 뒤에도 401이면 더 갱신하지 않고 세션 종료로 본다', async () => {
    const tokens = createAccessTokenHolder();
    tokens.set('old');
    const server = fakeRefreshApi([{ ok: true, accessToken: 'new', onboardingCompleted: true }]);
    const refresher = createTokenRefresher(server.api, tokens);
    const pending = callWithRefresh(protectedCall(() => 'never'), refresher, tokens);
    await new Promise((r) => setImmediate(r));
    server.releaseAll();
    const result = await pending;
    assert.equal('sessionEnded' in result && result.sessionEnded, true);
    assert.equal(server.calls, 1);
  });

  test('쿠키가 아예 없으면(noSession) 만료 문구 없이 로그인 화면으로 보낸다(OD-07)', async () => {
    const tokens = createAccessTokenHolder();
    const server = fakeRefreshApi([{ ok: false, reason: 'noSession' }]);
    const pending = callWithRefresh(protectedCall(() => 'never'), createTokenRefresher(server.api, tokens), tokens);
    await new Promise((r) => setImmediate(r));
    server.releaseAll();
    assert.deepEqual(await pending, { ok: false, status: 401, sessionEnded: true, message: null });
  });

  test('다른 요청의 갱신이 실패해 토큰이 비었으면, 늦게 401을 받은 요청은 다시 갱신하지 않는다', async () => {
    const tokens = createAccessTokenHolder();
    tokens.set('old');
    const server = fakeRefreshApi([{ ok: false, reason: 'invalid' }]);
    const refresher = createTokenRefresher(server.api, tokens);
    let releaseSlow: () => void = () => {};
    const slowCall: ApiCall<string> = () =>
      new Promise((resolve) => {
        releaseSlow = () => resolve({ ok: false, status: 401 });
      });
    const slow = callWithRefresh(slowCall, refresher, tokens);
    const fast = callWithRefresh(protectedCall(() => 'never'), refresher, tokens);
    await new Promise((r) => setImmediate(r));
    server.releaseAll();
    await fast;
    releaseSlow();
    assert.deepEqual(await slow, { ok: false, status: 401, sessionEnded: true, message: SESSION_EXPIRED_MESSAGE });
    assert.equal(server.calls, 1);
  });

  test('401이 아닌 실패는 그대로 돌려준다', async () => {
    const tokens = createAccessTokenHolder();
    const server = fakeRefreshApi([]);
    const result = await callWithRefresh(async () => ({ ok: false, status: 500 }), createTokenRefresher(server.api, tokens), tokens);
    assert.deepEqual(result, { ok: false, status: 500 });
    assert.equal(server.calls, 0);
  });
});

describe('DTL-AUT-039 재로그인 뒤 보던 화면으로 복귀', () => {
  test('앱 안의 경로는 그대로 돌려준다', () => {
    assert.equal(safeReturnPath('/calendar?date=2026-10-06'), '/calendar?date=2026-10-06');
  });

  test('바깥 주소·로그인 화면·빈 값은 받지 않는다', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example', 'calendar', '/login', '/login?next=/x', '/signup/terms', null, undefined]) {
      assert.equal(safeReturnPath(bad), null, String(bad));
    }
  });

  test("'/loginhelp'처럼 이름만 비슷한 경로는 막지 않는다", () => {
    assert.equal(safeReturnPath('/loginhelp'), '/loginhelp');
  });
});
