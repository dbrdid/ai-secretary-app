import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccessTokenHolder, restoreSession, type RefreshResult, type SessionApi } from './session.ts';
import { createSingleFlightSessionApi } from './sessionRefresh.ts';

function deferred() {
  let resolve!: (result: RefreshResult) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<RefreshResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const success: RefreshResult = { ok: true, accessToken: 'test-only-token', onboardingCompleted: true };

function controlled() {
  const requests: ReturnType<typeof deferred>[] = [];
  const api: SessionApi = {
    refresh() {
      const request = deferred();
      requests.push(request);
      return request.promise;
    },
  };
  return { api, requests };
}

function threeCalls(wrapper: SessionApi) {
  const first = wrapper.refresh();
  const second = wrapper.refresh();
  const third = wrapper.refresh();
  assert.strictEqual(first, second);
  assert.strictEqual(second, third);
  return [first, second, third] as const;
}

describe('createSingleFlightSessionApi', () => {
  test('동시 3호출은 같은 Promise와 실제 1회 요청, 성공 직후 새 요청', async () => {
    const { api, requests } = controlled();
    const wrapper = createSingleFlightSessionApi(api);
    const calls = threeCalls(wrapper);
    assert.equal(requests.length, 0);
    await Promise.resolve();
    assert.equal(requests.length, 1);
    requests[0]!.resolve(success);
    assert.strictEqual(await calls[0], success);
    const next = wrapper.refresh();
    assert.notStrictEqual(next, calls[0]);
    await Promise.resolve();
    assert.equal(requests.length, 2);
    const renewed: RefreshResult = { ...success, accessToken: 'test-only-renewed' };
    requests[1]!.resolve(renewed);
    for (const result of await Promise.all(calls)) assert.strictEqual(result, success);
    assert.strictEqual(await next, renewed);
  });

  for (const reason of ['noSession', 'expired', 'invalid', 'network'] as const) {
    test(reason + ' 실패 결과도 공유하고 완료 직후 재시도', async () => {
      const { api, requests } = controlled();
      const wrapper = createSingleFlightSessionApi(api);
      const calls = threeCalls(wrapper);
      await Promise.resolve();
      assert.equal(requests.length, 1);
      const failure: RefreshResult = { ok: false, reason };
      requests[0]!.resolve(failure);
      assert.strictEqual(await calls[0], failure);
      const retry = wrapper.refresh();
      assert.notStrictEqual(retry, calls[0]);
      await Promise.resolve();
      assert.equal(requests.length, 2);
      requests[1]!.resolve(success);
      for (const result of await Promise.all(calls)) assert.strictEqual(result, failure);
      assert.strictEqual(await retry, success);
    });
  }

  for (const mode of ['reject', 'sync throw'] as const) {
    test(mode + '는 내용 없는 network로 공유하고 재시도', async () => {
      const gate = deferred();
      let count = 0;
      const wrapper = createSingleFlightSessionApi({
        refresh() {
          count++;
          if (count > 1) return Promise.resolve(success);
          if (mode === 'sync throw') throw new Error('synthetic error detail must not escape');
          return gate.promise;
        },
      });
      const calls = threeCalls(wrapper);
      await Promise.resolve();
      assert.equal(count, 1);
      if (mode === 'reject') gate.reject(new Error('synthetic error detail must not escape'));
      const failure = await calls[0];
      assert.deepEqual(failure, { ok: false, reason: 'network' });
      const retry = wrapper.refresh();
      assert.notStrictEqual(retry, calls[0]);
      assert.strictEqual(await retry, success);
      assert.equal(count, 2);
      for (const result of await Promise.all(calls)) assert.strictEqual(result, failure);
    });
  }

  test('같은 원본 API라도 wrapper 인스턴스 사이에는 pending을 공유하지 않는다', async () => {
    const { api, requests } = controlled();
    const first = createSingleFlightSessionApi(api);
    const second = createSingleFlightSessionApi(api);
    const a = threeCalls(first);
    const b = threeCalls(second);
    assert.notStrictEqual(a[0], b[0]);
    await Promise.resolve();
    assert.equal(requests.length, 2);
    requests[0]!.resolve(success);
    await a[0];
    assert.strictEqual(second.refresh(), b[0], '다른 wrapper 완료가 pending을 해제하지 않는다');
    const other: RefreshResult = { ok: false, reason: 'invalid' };
    requests[1]!.resolve(other);
    for (const result of await Promise.all(a)) assert.strictEqual(result, success);
    for (const result of await Promise.all(b)) assert.strictEqual(result, other);
  });

  test('restoreSession 동시 3복원과 직접 refresh가 같은 wrapper를 공유한다', async () => {
    const { api, requests } = controlled();
    const wrapper = createSingleFlightSessionApi(api);
    const tokens = createAccessTokenHolder();
    const restores = [
      restoreSession(wrapper, tokens),
      restoreSession(wrapper, tokens),
      restoreSession(wrapper, tokens),
    ];
    const direct = wrapper.refresh();
    await Promise.resolve();
    assert.equal(requests.length, 1);
    requests[0]!.resolve(success);
    assert.deepEqual(await Promise.all(restores), [{ screen: 'home' }, { screen: 'home' }, { screen: 'home' }]);
    assert.strictEqual(await direct, success);
    assert.equal(tokens.get(), success.accessToken);
    assert.equal(requests.length, 1);
  });
});
