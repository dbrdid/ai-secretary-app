/**
 * 온보딩 건너뛰기 — DTL-SET-003(기본값 적용). 저장 내용은 DTL-SET-004(완료 플래그와 설정값).
 * 원문: [건너뛰기]를 누르면 기본값을 저장하고 홈으로 이동하며 "설정에서 언제든 변경할 수 있어요"
 * 토스트를 표시한다.
 *
 * 기본값은 DTL-SET-003 괄호 안의 목록이다. 필드 이름과 선택지는 DTL-SET-007(AI 자동 분석),
 * DTL-SET-009(AI 확인 방식), DTL-SET-011(일간 브리핑), DTL-SET-012(주간 브리핑)에서 따왔다.
 * 서버로 보낼 형식은 저장 API(DTL-SET-004) 담당과 맞춘 뒤 바꾼다.
 *
 * 원문대로 앞 단계에서 사용자가 바꾼 값이 있어도 건너뛰면 기본값을 저장한다(팀 확인 대상).
 *
 * [임시 가정] 기기 시간대를 함께 저장한다(DTL-SET-013). 읽지 못하면 Asia/Seoul.
 * [임시 처리] 저장 실패 처리는 시트에 없다. 실패하면 홈으로 가지 않고 실패를 돌려준다. 저장 없이
 * 홈으로 가면 완료 플래그가 없어 다음 로그인 때 온보딩이 다시 뜨는데(DTL-SET-004), 사용자는
 * 건너뛰었다고 알고 있어 어긋나기 때문이다. 실패 문구와 재시도 방식은 팀이 정한다.
 */

import type { DailyBriefing, WeeklyBriefing } from '../settings/briefing.ts';

export const SKIP_TOAST = '설정에서 언제든 변경할 수 있어요';
export const FALLBACK_TIME_ZONE = 'Asia/Seoul';

export type AiConfirmMode = 'confirmAll' | 'autoSaveHighConfidence';

export type OnboardingSettings = {
  readonly aiAutoAnalysis: boolean;
  readonly aiConfirmMode: AiConfirmMode;
  /** time은 'HH:mm'(DTL-SET-011: 00:00~23:30, 30분 단위). 검사는 settings/briefing.ts */
  readonly dailyBriefing: DailyBriefing;
  /** 요일·시각은 켤 때 정한다(DTL-SET-012). 건너뛰기 기본값은 꺼짐이라 두지 않는다. */
  readonly weeklyBriefing: WeeklyBriefing;
  readonly timeZone: string;
};

export type OnboardingSavePayload = {
  readonly onboardingCompleted: true;
  readonly settings: OnboardingSettings;
};

export function defaultOnboardingSettings(timeZone: string): OnboardingSettings {
  return {
    aiAutoAnalysis: true,
    aiConfirmMode: 'confirmAll',
    dailyBriefing: { enabled: true, time: '08:00' },
    weeklyBriefing: { enabled: false },
    timeZone,
  };
}

/** 기기 시간대. 읽기에 실패하거나 알 수 없는 이름이면 Asia/Seoul. */
export function resolveTimeZone(read: () => string | undefined): string {
  try {
    const zone = read();
    if (!zone) return FALLBACK_TIME_ZONE;
    new Intl.DateTimeFormat('en-US', { timeZone: zone }); // 모르는 이름이면 RangeError
    return zone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export function readDeviceTimeZone(): string | undefined {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export type SkipDeps = {
  save(payload: OnboardingSavePayload): Promise<void>;
  goHome(): void;
  showToast(message: string): void;
  deviceTimeZone?: () => string | undefined;
};

export type SkipResult = { readonly status: 'done' } | { readonly status: 'failed'; readonly error: unknown } | { readonly status: 'ignored' };

/**
 * [건너뛰기] 처리기를 만든다. 저장이 끝나기 전에 다시 누르면 무시한다(ignored) — 두 번 저장하고
 * 홈 이동·토스트가 겹치는 것을 막는다.
 */
export function createSkipHandler(deps: SkipDeps): () => Promise<SkipResult> {
  let pending = false;
  // 저장이 끝난 뒤의 누름(화면 전환 전 연타)도 무시한다. 완료 플래그는 이미 저장됐으므로 다시
  // 저장하면 요청만 늘고 토스트가 두 번 뜬다.
  let completed = false;
  return async () => {
    if (pending || completed) return { status: 'ignored' };
    pending = true;
    const payload: OnboardingSavePayload = {
      onboardingCompleted: true,
      settings: defaultOnboardingSettings(resolveTimeZone(deps.deviceTimeZone ?? readDeviceTimeZone)),
    };
    try {
      await deps.save(payload);
    } catch (error) {
      return { status: 'failed', error };
    } finally {
      pending = false;
    }
    completed = true;
    deps.goHome();
    deps.showToast(SKIP_TOAST);
    return { status: 'done' };
  };
}
