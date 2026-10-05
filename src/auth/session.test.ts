import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSessionServer } from '../adapters/fake/fakeSessionServer.ts';
import {
  KEEP_LOGGED_IN_DAYS,
  KEEP_LOGGED_IN_DEFAULT,
  SESSION_EXPIRED_MESSAGE,
  createAccessTokenHolder,
  refreshCookiePolicy,
  restoreSession,
  screenAfterRefresh,
  type SessionApi,
} from './session.ts';

const DAY = 24 * 60 * 60 * 1000;
const EMAIL = 'kim@example.com';
const PASSWORD = 'Secret#2026';

function setup(onboardingCompleted = true) {
  let now = Date.parse('2026-10-01T00:00:00.000Z');
  const server = createFakeSessionServer({
    now: () => now,
    accounts: { [EMAIL]: { password: PASSWORD, onboardingCompleted } },
  });
  return {
    server,
    advance: (ms: number) => {
      now += ms;
    },
    login: async (keepLoggedIn: boolean) => {
      const result = await server.login({ email: EMAIL, password: PASSWORD, keepLoggedIn });
      assert.equal(result.ok, true);
    },
  };
}

describe('DTL-AUT-035 로그인 유지 규칙', () => {
  test('기본값은 미체크', () => {
    assert.equal(KEEP_LOGGED_IN_DEFAULT, false);
  });

  test('체크하면 14일 가는 쿠키, 안 하면 브라우저를 닫으면 사라지는 세션 쿠키', () => {
    assert.equal(KEEP_LOGGED_IN_DAYS, 14);
    assert.deepEqual(refreshCookiePolicy(true), { persistent: true, maxAgeSeconds: 14 * 24 * 60 * 60 });
    assert.deepEqual(refreshCookiePolicy(false), { persistent: false });
    assert.deepEqual(refreshCookiePolicy(true, 30), { persistent: true, maxAgeSeconds: 30 * 24 * 60 * 60 });
  });
});

describe('DTL-AUT-037 재진입 때 세션 복원 — 가짜 서버', () => {
  test('유지를 체크했으면 브라우저를 닫았다 열어도 로그인 화면 없이 홈으로', async () => {
    const { server, advance, login } = setup();
    await login(true);
    server.closeBrowser();
    advance(13 * DAY);
    const tokens = createAccessTokenHolder();
    assert.deepEqual(await restoreSession(server, tokens), { screen: 'home' });
    assert.notEqual(tokens.get(), null, 'Access 토큰은 메모리 보관함에 들어간다');
  });

  test('유지를 안 했으면 브라우저를 닫은 뒤에는 로그인 화면(만료 문구 없음)', async () => {
    const { server, login } = setup();
    await login(false);
    server.closeBrowser();
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'login', message: null });
  });

  test('유지를 안 했어도 브라우저를 닫지 않고 새로고침만 했으면 이어진다', async () => {
    const { server, login } = setup();
    await login(false);
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'home' });
  });

  test('14일이 지나면 브라우저가 쿠키를 지워 처음 온 사람과 같다: 문구 없이 로그인 화면(OD-07)', async () => {
    const { server, advance, login } = setup();
    await login(true);
    advance(14 * DAY);
    assert.equal(server.hasCookie(), false);
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'login', message: null });
  });

  test('서버가 만료라고 알리면 만료 문구(DTL-AUT-039)와 함께 로그인 화면', async () => {
    const { server, advance, login } = setup();
    await login(false);
    advance(15 * DAY); // 브라우저를 닫지 않은 채 서버 쪽 수명이 끝났다
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'login', message: SESSION_EXPIRED_MESSAGE });
  });

  test('다른 기기에서 비밀번호를 바꿔 폐기됐으면 만료 문구, 보관함은 비운다', async () => {
    const { server, login } = setup();
    await login(true);
    server.revokeAll(EMAIL);
    const tokens = createAccessTokenHolder();
    tokens.set('이전-토큰');
    assert.deepEqual(await restoreSession(server, tokens), { screen: 'login', message: SESSION_EXPIRED_MESSAGE });
    assert.equal(tokens.get(), null);
  });

  test('온보딩을 마치지 않았으면 초기 설정으로(DTL-AUT-032와 같은 규칙)', async () => {
    const { server, login } = setup(false);
    await login(true);
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'onboarding' });
  });

  test('[임시 가정 OD-07] 네트워크 오류면 로그아웃시키지 않고 다시 시도, 연결되면 이어진다', async () => {
    const { server, login } = setup();
    await login(true);
    server.setOffline(true);
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'retry' });
    server.setOffline(false);
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'home' });
  });

  test('refresh가 던져도(fetch 실패) 네트워크 오류로 본다', async () => {
    const throwing: SessionApi = {
      refresh: async () => {
        throw new TypeError('Failed to fetch');
      },
    };
    assert.deepEqual(await restoreSession(throwing, createAccessTokenHolder()), { screen: 'retry' });
  });

  test('재발급할 때마다 토큰이 바뀌어도(회전) 다음 재진입이 된다', async () => {
    const { server, login } = setup();
    await login(true);
    const first = createAccessTokenHolder();
    const second = createAccessTokenHolder();
    assert.deepEqual(await restoreSession(server, first), { screen: 'home' });
    assert.deepEqual(await restoreSession(server, second), { screen: 'home' });
    assert.notEqual(first.get(), second.get());
  });

  test('로그인한 적이 없으면 문구 없이 로그인 화면', async () => {
    const { server } = setup();
    assert.deepEqual(await restoreSession(server, createAccessTokenHolder()), { screen: 'login', message: null });
  });
});

describe('screenAfterRefresh — 실패 이유별 화면', () => {
  test('세션 없음은 문구 없이, 만료·폐기는 만료 문구, 네트워크는 다시 시도', () => {
    assert.deepEqual(screenAfterRefresh({ ok: false, reason: 'noSession' }), { screen: 'login', message: null });
    assert.deepEqual(screenAfterRefresh({ ok: false, reason: 'expired' }), { screen: 'login', message: SESSION_EXPIRED_MESSAGE });
    assert.deepEqual(screenAfterRefresh({ ok: false, reason: 'invalid' }), { screen: 'login', message: SESSION_EXPIRED_MESSAGE });
    assert.deepEqual(screenAfterRefresh({ ok: false, reason: 'network' }), { screen: 'retry' });
  });
});
