/**
 * 녹음 상태와 경과 시간 — DTL-INB-005(일시정지·재개, 상위 REQ-INB-005), REQ-INB-004(녹음 중 경과 시간·상태 확인).
 * 원문
 * - DTL-INB-005: [일시정지] 탭 시 버퍼 저장을 멈추고 대기하며, [재개] 시 기존 버퍼에 이어서 녹음을 기록(Append)한다.
 * - DTL-INB-004(UI): 녹음 시작 시 현재 경과 시간(MM:SS)과 … 오디오 파형을 실시간으로 렌더링한다.
 * 실제 마이크와 버퍼(브라우저 MediaRecorder 등)는 플랫폼이 정해진 뒤(docs/open-decisions.md OD-01) 어댑터로 붙인다.
 * 여기서는 상태 바뀜과 녹음된 시간만 계산한다. 어댑터는 이 상태가 바뀔 때만 실제 녹음기를 멈추고 잇는다.
 *
 * 결정과 이유
 * - 경과 시간은 일시정지한 동안을 빼고 센다. 화면 표시와 3초 미만 녹음 판정(DTL-INB-006, 예외 담당)이 같은 값을
 *   쓰게 하려는 것이다.
 * - 시각은 밀리초 숫자로 주입받는다. 화면에서는 performance.now()처럼 거꾸로 가지 않는 시계를 넘긴다
 *   (shared/cooldown.ts와 같은 이유: 기기 시각을 바꾸면 Date.now()가 튄다).
 * - 받을 수 없는 동작(녹음 중이 아닐 때 일시정지, 끝난 뒤 재개 등)은 accepted=false로 돌려주고 상태를 그대로 둔다.
 *   버튼 연타나 늦게 온 이벤트로 상태가 꼬이지 않게 한다.
 * - [임시 가정] 60분이 넘어도 원문 형식(MM:SS)대로 분이 60, 61…로 는다. 최대 녹음 길이와 한 시간 넘는 표시는 OD-20.
 */

export type RecorderState =
  | { readonly status: 'idle' }
  /** since: 마지막으로 시작·재개한 시각. recordedMs: 그 전까지 녹음된 길이. */
  | { readonly status: 'recording'; readonly recordedMs: number; readonly since: number }
  | { readonly status: 'paused'; readonly recordedMs: number }
  | { readonly status: 'stopped'; readonly recordedMs: number };

export type RecorderAction = 'start' | 'pause' | 'resume' | 'stop';

export const RECORDER_IDLE: RecorderState = { status: 'idle' };

// 시계가 거꾸로 가도(잘못 넘긴 값) 녹음 길이가 줄지 않게 한다.
const span = (since: number, now: number): number => Math.max(0, now - since);

export function recorderStep(state: RecorderState, action: RecorderAction, now: number): { readonly accepted: boolean; readonly state: RecorderState } {
  const next = ((): RecorderState | null => {
    switch (action) {
      case 'start':
        return state.status === 'idle' ? { status: 'recording', recordedMs: 0, since: now } : null;
      case 'pause':
        return state.status === 'recording' ? { status: 'paused', recordedMs: state.recordedMs + span(state.since, now) } : null;
      case 'resume':
        return state.status === 'paused' ? { status: 'recording', recordedMs: state.recordedMs, since: now } : null;
      case 'stop':
        if (state.status === 'recording') return { status: 'stopped', recordedMs: state.recordedMs + span(state.since, now) };
        if (state.status === 'paused') return { status: 'stopped', recordedMs: state.recordedMs };
        return null;
    }
  })();
  return next === null ? { accepted: false, state } : { accepted: true, state: next };
}

/** 지금까지 녹음된 길이(일시정지한 동안 제외). */
export function recordedMs(state: RecorderState, now: number): number {
  switch (state.status) {
    case 'idle':
      return 0;
    case 'recording':
      return state.recordedMs + span(state.since, now);
    case 'paused':
    case 'stopped':
      return state.recordedMs;
  }
}

/** 'MM:SS'. 초 아래는 버린다(시작 직후 00:00, 1초가 지나야 00:01). */
export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
