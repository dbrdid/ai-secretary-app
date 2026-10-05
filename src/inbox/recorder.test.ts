import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDER_IDLE,
  formatElapsed,
  recordedMs,
  recorderStep,
  type RecorderAction,
  type RecorderState,
} from './recorder.ts';

/** 동작을 차례로 적용한다. 모두 받아들여져야 한다. */
function play(steps: ReadonlyArray<readonly [RecorderAction, number]>): RecorderState {
  let state: RecorderState = RECORDER_IDLE;
  for (const [action, at] of steps) {
    const result = recorderStep(state, action, at);
    assert.equal(result.accepted, true, `${action}@${at}`);
    state = result.state;
  }
  return state;
}

describe('recorderStep — 녹음 상태와 경과 시간(REQ-INB-004, DTL-INB-005)', () => {
  test('시작하면 녹음 중, 경과 시간은 시작부터 센다', () => {
    const state = play([['start', 1_000]]);
    assert.equal(state.status, 'recording');
    assert.equal(recordedMs(state, 4_500), 3_500);
  });

  test('일시정지한 동안은 빼고, 재개하면 이어서 센다(Append)', () => {
    const paused = play([['start', 0], ['pause', 5_000]]);
    assert.equal(paused.status, 'paused');
    assert.equal(recordedMs(paused, 60_000), 5_000, '멈춘 동안은 늘지 않는다');

    const resumed = play([['start', 0], ['pause', 5_000], ['resume', 20_000]]);
    assert.equal(recordedMs(resumed, 26_000), 11_000);

    const stopped = play([['start', 0], ['pause', 5_000], ['resume', 20_000], ['stop', 26_000]]);
    assert.deepEqual(stopped, { status: 'stopped', recordedMs: 11_000 });
  });

  test('일시정지 중에 끝내면 멈춘 때까지의 길이', () => {
    assert.deepEqual(play([['start', 0], ['pause', 7_000], ['stop', 30_000]]), { status: 'stopped', recordedMs: 7_000 });
  });

  test('받을 수 없는 동작은 accepted=false, 상태는 그대로(버튼 연타·늦게 온 이벤트)', () => {
    const recording = play([['start', 0]]);
    const stopped = play([['start', 0], ['stop', 1_000]]);
    const cases: Array<readonly [RecorderState, RecorderAction]> = [
      [RECORDER_IDLE, 'pause'],
      [RECORDER_IDLE, 'resume'],
      [RECORDER_IDLE, 'stop'],
      [recording, 'start'],
      [recording, 'resume'],
      [stopped, 'start'],
      [stopped, 'resume'],
      [stopped, 'pause'],
    ];
    for (const [state, action] of cases) {
      const result = recorderStep(state, action, 2_000);
      assert.equal(result.accepted, false, `${state.status}에서 ${action}`);
      assert.equal(result.state, state);
    }
  });

  test('시계가 거꾸로 가도(잘못 넘긴 값) 길이가 줄지 않는다', () => {
    assert.equal(recordedMs(play([['start', 10_000]]), 5_000), 0);
    assert.deepEqual(play([['start', 10_000], ['pause', 9_000]]), { status: 'paused', recordedMs: 0 });
  });

  test('시작 전 경과 시간은 0', () => {
    assert.equal(recordedMs(RECORDER_IDLE, 99_000), 0);
  });
});

describe('formatElapsed — MM:SS 표시', () => {
  test('초 아래는 버린다', () => {
    assert.equal(formatElapsed(0), '00:00');
    assert.equal(formatElapsed(999), '00:00');
    assert.equal(formatElapsed(1_000), '00:01');
    assert.equal(formatElapsed(61_500), '01:01');
  });

  test('음수는 00:00', () => {
    assert.equal(formatElapsed(-5_000), '00:00');
  });

  test('[임시 가정 OD-20] 60분이 넘으면 분이 60, 61…로 는다', () => {
    assert.equal(formatElapsed(3_600_000), '60:00');
    assert.equal(formatElapsed(3_661_000), '61:01');
  });
});
