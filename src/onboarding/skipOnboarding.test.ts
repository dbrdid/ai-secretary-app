import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_TIME_ZONE,
  SKIP_TOAST,
  createSkipHandler,
  defaultOnboardingSettings,
  resolveTimeZone,
  type OnboardingSavePayload,
  type SkipDeps,
} from './skipOnboarding.ts';

function fakeDeps(overrides: Partial<SkipDeps> = {}) {
  const calls: string[] = [];
  const saved: OnboardingSavePayload[] = [];
  const toasts: string[] = [];
  const deps: SkipDeps = {
    save: async (payload) => {
      calls.push('save');
      saved.push(payload);
    },
    goHome: () => calls.push('goHome'),
    showToast: (m) => {
      calls.push('toast');
      toasts.push(m);
    },
    deviceTimeZone: () => 'Asia/Tokyo',
    ...overrides,
  };
  return { deps, calls, saved, toasts };
}

describe('DTL-SET-003 건너뛰기 기본값', () => {
  test('원문 기본값: AI 자동 분석 On, 모든 결과 확인 후 저장, 일간 On 08:00, 주간 Off', () => {
    assert.deepEqual(defaultOnboardingSettings('Asia/Seoul'), {
      aiAutoAnalysis: true,
      aiConfirmMode: 'confirmAll',
      dailyBriefing: { enabled: true, time: '08:00' },
      weeklyBriefing: { enabled: false },
      timeZone: 'Asia/Seoul',
    });
  });

  test('누르면 완료 플래그와 기본값을 저장한 뒤 홈 이동, 토스트 순서로 처리한다', async () => {
    const { deps, calls, saved, toasts } = fakeDeps();
    const result = await createSkipHandler(deps)();
    assert.deepEqual(result, { status: 'done' });
    assert.deepEqual(calls, ['save', 'goHome', 'toast']);
    assert.deepEqual(saved, [{ onboardingCompleted: true, settings: defaultOnboardingSettings('Asia/Tokyo') }]);
    assert.deepEqual(toasts, [SKIP_TOAST]);
    assert.equal(SKIP_TOAST, '설정에서 언제든 변경할 수 있어요');
  });
});

describe('DTL-SET-003 [임시 가정] 기기 시간대 저장', () => {
  test('읽은 시간대가 유효하면 그대로 쓴다', () => {
    assert.equal(resolveTimeZone(() => 'America/New_York'), 'America/New_York');
  });

  test('없음·빈 값·모르는 이름·읽기 오류면 Asia/Seoul', () => {
    assert.equal(resolveTimeZone(() => undefined), FALLBACK_TIME_ZONE);
    assert.equal(resolveTimeZone(() => ''), FALLBACK_TIME_ZONE);
    assert.equal(resolveTimeZone(() => 'Mars/Olympus'), FALLBACK_TIME_ZONE);
    assert.equal(
      resolveTimeZone(() => {
        throw new Error('no Intl');
      }),
      FALLBACK_TIME_ZONE,
    );
    assert.equal(FALLBACK_TIME_ZONE, 'Asia/Seoul');
  });

  test('처리기도 시간대를 못 읽으면 Asia/Seoul로 저장한다', async () => {
    const { deps, saved } = fakeDeps({ deviceTimeZone: () => undefined });
    await createSkipHandler(deps)();
    assert.equal(saved[0]?.settings.timeZone, 'Asia/Seoul');
  });
});

describe('DTL-SET-003 [임시 처리] 저장 실패', () => {
  test('저장이 실패하면 홈으로 가지 않고 토스트도 없이 실패를 돌려준다', async () => {
    const boom = new Error('network');
    const { deps, calls } = fakeDeps({
      save: async () => {
        calls.push('save');
        throw boom;
      },
    });
    const result = await createSkipHandler(deps)();
    assert.deepEqual(result, { status: 'failed', error: boom });
    assert.deepEqual(calls, ['save']);
  });

  test('실패 뒤 다시 누르면 재시도하고, 성공하면 홈으로 간다', async () => {
    let attempt = 0;
    const { deps, calls } = fakeDeps({
      save: async () => {
        calls.push('save');
        attempt += 1;
        if (attempt === 1) throw new Error('network');
      },
    });
    const skip = createSkipHandler(deps);
    assert.equal((await skip()).status, 'failed');
    assert.equal((await skip()).status, 'done');
    assert.deepEqual(calls, ['save', 'save', 'goHome', 'toast']);
  });
});

describe('DTL-SET-003 두 번 누름', () => {
  test('저장 중에 다시 누르면 무시한다(저장 1회, 홈 이동·토스트 1회)', async () => {
    let release: () => void = () => {};
    const { deps, calls } = fakeDeps({
      save: () => {
        calls.push('save');
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const skip = createSkipHandler(deps);
    const first = skip();
    const second = await skip();
    assert.deepEqual(second, { status: 'ignored' });
    release();
    assert.deepEqual(await first, { status: 'done' });
    assert.deepEqual(calls, ['save', 'goHome', 'toast']);
  });

  test('완료 뒤에 다시 눌러도 다시 저장하지 않는다', async () => {
    const { deps, calls } = fakeDeps();
    const skip = createSkipHandler(deps);
    await skip();
    assert.deepEqual(await skip(), { status: 'ignored' });
    assert.deepEqual(calls, ['save', 'goHome', 'toast']);
  });
});
