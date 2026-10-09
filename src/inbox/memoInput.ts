/**
 * 메모 입력 길이와 빈 메모, 너무 짧은 녹음 — DTL-INB-003(상위 REQ-INB-003), REQ-INB-016, DTL-INB-006(상위 REQ-INB-006).
 * 원문
 * - DTL-INB-003: 메모 하나는 최대 10,000자. 넘으면 "더 이상 입력할 수 없습니다" 경고.
 * - REQ-INB-016: 내용이 없는 메모는 저장하지 않고 안내한다.
 * - DTL-INB-006: 3초 미만 녹음 뒤 종료하면 데이터를 버리고 "녹음 시간이 너무 짧습니다" 토스트.
 *
 * 결정과 이유
 * - 글자 수는 코드 포인트로 센다(signupRules.ts와 같은 기준). 이모지 하나를 2자로 세지 않는다. 한글 완성형은 1자다.
 * - 넘친 입력은 10,000자에서 자르고 경고를 띄운다. 붙여넣기로 한꺼번에 넘친 경우도 같다. 자를 때 이모지가 반으로 갈라지지
 *   않게 코드 포인트 단위로 자른다.
 * - 빈 메모 판단은 contracts/items.ts의 checkContent('emptyBody')와 같은 기준(앞뒤 공백 제거)이다. 화면에서 미리 막고
 *   저장소가 한 번 더 막는다.
 * - [합의 필요] 빈 메모 안내 문구는 원문에 없다. 문구는 화면 담당이 정하고, 여기서는 막을지만 알린다.
 * - 녹음 길이는 recorder.ts의 recordedMs(일시정지 시간 제외)를 넘긴다.
 */

export const MEMO_MAX_CHARS = 10_000; // DTL-INB-003
export const MIN_RECORDING_MS = 3_000; // DTL-INB-006

export const MEMO_MESSAGES = {
  tooLong: '더 이상 입력할 수 없습니다', // DTL-INB-003
  recordingTooShort: '녹음 시간이 너무 짧습니다', // DTL-INB-006
} as const;

export function memoLength(text: string): number {
  let count = 0;
  for (const _ of text) count += 1; // 코드 포인트 단위
  return count;
}

/** DTL-INB-003: 입력값을 최대 길이로 자른다. 잘랐으면 경고 문구를 같이 돌려준다. */
export function clampMemoInput(text: string, max: number = MEMO_MAX_CHARS): { readonly text: string; readonly warning: string | null } {
  const chars = Array.from(text); // 코드 포인트 단위, 한 번만 나눈다
  if (chars.length <= max) return { text, warning: null };
  return { text: chars.slice(0, max).join(''), warning: MEMO_MESSAGES.tooLong };
}

/** REQ-INB-016: 저장할 수 있는 내용인지. */
export function isEmptyMemo(text: string): boolean {
  return text.trim() === '';
}

/** DTL-INB-006: 이 길이로 끝낸 녹음을 버려야 하는지. */
export function isRecordingTooShort(recordedMs: number): boolean {
  return recordedMs < MIN_RECORDING_MS;
}
