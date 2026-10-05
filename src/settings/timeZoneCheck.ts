/**
 * 브리핑 시간대 확인 — DTL-SET-013(상위 REQ-SET-009·010).
 * 원문: 브리핑 시각은 기기의 시간대(기본 Asia/Seoul)와 함께 서버에 저장한다. 저장된 시간대와 현재 기기의
 * 시간대가 다르면 변경 여부를 묻는 팝업을 띄운다.
 *
 * 저장할 때 넣는 시간대는 onboarding/skipOnboarding.ts의 resolveTimeZone(못 읽으면 Asia/Seoul)을 그대로 쓴다.
 * 이 파일은 앱을 열 때 '물을지'와 '바꾸면 무엇이 저장되는지'만 정한다. 팝업 문구와 모양은 화면 담당 몫이다.
 *
 * 결정과 이유
 * - 비교할 때 기기 시간대를 못 읽으면 묻지 않는다. 저장할 때처럼 Asia/Seoul로 채워 비교하면, 뉴욕으로 저장한
 *   사용자에게 근거 없이 '서울로 바꿀까요?'를 묻게 된다.
 * - 같은 시간대의 다른 이름(별칭: Asia/Kolkata·Asia/Calcutta, US/Eastern·America/New_York)은 같은 것으로 본다.
 *   기기마다 같은 곳을 다른 이름으로 알려 주는 일이 있어, 그대로 비교하면 기기를 바꿀 때마다 팝업이 뜬다.
 *   이름은 Intl이 돌려주는 정식 이름으로 맞춘다. [한계] 시간대 이름을 정규화하지 않는 새 규칙을 따르는 엔진에서는
 *   별칭 차이로도 팝업이 뜰 수 있다. 서버가 저장할 때 이름을 맞출지는 논의 OD-10.
 * - 이름은 달라도 지금 시차가 같은 도시(서울↔도쿄)는 원문대로 다른 시간대로 보고 묻는다. 논의 OD-10.
 * - [임시 가정] 사용자가 '바꾸지 않음'을 고르면 같은 (저장값, 기기값) 조합으로는 다시 묻지 않는다. 기기 시간대가 또
 *   바뀌거나 저장값이 바뀌면 다시 묻는다. 여행 중 앱을 열 때마다 묻는 것을 막으려는 것이다. 원문에 없다(OD-10).
 * - [임시 가정] '바꾸기'를 고르면 시각('08:00')은 그대로 두고 시간대만 바꾼다. 같은 순간을 지키려고 시각을 환산하면
 *   +05:45 같은 시간대에서 일간 30분 단위(DTL-SET-011)를 벗어난다(OD-10).
 */
import type { TimeZone } from '../contracts/time.ts';

/** Intl이 아는 이름이면 정식 이름('asia/seoul' → 'Asia/Seoul'), 모르는 이름이면 null. */
export function canonicalTimeZone(name: string | undefined): TimeZone | null {
  if (name === undefined || name === '') return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone;
  } catch {
    return null; // 모르는 이름이면 RangeError
  }
}

export function sameTimeZone(a: string, b: string): boolean {
  if (a === b) return true;
  const ca = canonicalTimeZone(a);
  return ca !== null && ca === canonicalTimeZone(b);
}

/** 사용자가 '바꾸지 않음'을 고른 조합. 기기에 남긴다(계정에 남길지는 OD-10). */
export type DeclinedTimeZone = { readonly saved: TimeZone; readonly device: TimeZone };

export type TimeZonePrompt =
  | { readonly ask: false; readonly reason: 'same' | 'deviceUnknown' | 'declinedBefore' }
  | { readonly ask: true; readonly saved: TimeZone; readonly device: TimeZone };

/** 앱을 열 때(또는 설정 화면에 들어갈 때) 부른다. */
export function timeZonePrompt(input: {
  readonly saved: TimeZone;
  /** readDeviceTimeZone()의 결과 그대로. 못 읽었으면 undefined. */
  readonly device: string | undefined;
  readonly declined?: DeclinedTimeZone | null;
}): TimeZonePrompt {
  // 비교는 정식 이름으로 하지만, 묻고 저장하는 값은 기기가 알려 준 이름 그대로 둔다. 정식 이름이 옛 표기
  // (Asia/Calcutta 등)인 엔진이 있어, 사용자에게 보이는 이름이 기기 설정과 달라지지 않게 하려는 것이다.
  const device = input.device;
  if (device === undefined || canonicalTimeZone(device) === null) return { ask: false, reason: 'deviceUnknown' };
  if (sameTimeZone(input.saved, device)) return { ask: false, reason: 'same' };
  const declined = input.declined;
  if (declined != null && sameTimeZone(declined.saved, input.saved) && sameTimeZone(declined.device, device)) {
    return { ask: false, reason: 'declinedBefore' };
  }
  return { ask: true, saved: input.saved, device };
}

/** '바꾸기': 시각은 그대로 두고 시간대만 바꾼 설정을 돌려준다. 저장은 부르는 쪽이 한다. */
export function acceptDeviceTimeZone<T extends { readonly timeZone: TimeZone }>(settings: T, device: TimeZone): T {
  return { ...settings, timeZone: device };
}

/** '바꾸지 않음': 기기에 남길 기록. 다음에 timeZonePrompt의 declined로 넘긴다. */
export function declineDeviceTimeZone(saved: TimeZone, device: TimeZone): DeclinedTimeZone {
  return { saved, device };
}
