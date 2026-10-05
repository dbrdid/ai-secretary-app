import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContent, showsAiBadge, type EventContent, type MemoContent, type Provenance, type TaskContent } from './items.ts';

const manual: Provenance = { origin: 'manual' };
const ai = (confirmation: 'autoSaved' | 'userConfirmed'): Provenance => ({
  origin: 'ai',
  confirmation,
  analysisId: 'an-1',
  candidateId: 'cand-1',
  evidence: [{ kind: 'text', sourceId: 'src-1', sourceVersion: 1, start: 0, end: 4 }],
});

const event = (schedule: EventContent['schedule'], title = '기획 회의'): EventContent => ({
  kind: 'event',
  title,
  schedule,
  place: null,
  recurrence: null,
  reminder: null,
  provenance: manual,
  projectId: null,
  tags: [],
});
const task = (over: Partial<TaskContent> = {}): TaskContent => ({
  kind: 'task',
  title: '발표 자료',
  due: null,
  completedAt: null,
  assigneeId: null,
  provenance: manual,
  projectId: null,
  tags: [],
  ...over,
});
const memo = (body: string): MemoContent => ({ kind: 'memo', body, provenance: manual, projectId: null, tags: [] });

describe('단계 0 저장 전 검사', () => {
  test('정상: 시각 일정·종일 일정·마감 없는 할 일·내용만 있는 메모(REQ-INB-001)', () => {
    assert.deepEqual(checkContent(event({ kind: 'timed', start: '2026-10-02T06:00:00Z', end: '2026-10-02T07:00:00Z', timeZone: 'Asia/Seoul' })), []);
    assert.deepEqual(checkContent(event({ kind: 'allDay', startDate: '2026-10-02', endDate: '2026-10-02' })), []);
    assert.deepEqual(checkContent(task()), []);
    assert.deepEqual(checkContent(memo('금요일까지 자료 정리')), []);
  });

  test('종료가 시작보다 앞서면 endBeforeStart, 같으면 받는다(원문에 최소 길이 없음)', () => {
    const at = (start: string, end: string) => event({ kind: 'timed', start, end, timeZone: 'Asia/Seoul' });
    assert.deepEqual(checkContent(at('2026-10-02T07:00:00Z', '2026-10-02T06:59:59.999Z')), ['endBeforeStart']);
    assert.deepEqual(checkContent(at('2026-10-02T07:00:00Z', '2026-10-02T07:00:00.000Z')), []);
    assert.deepEqual(checkContent(event({ kind: 'allDay', startDate: '2026-10-03', endDate: '2026-10-02' })), ['endBeforeStart']);
  });

  test('형식이 틀린 날짜·시각·시간대는 invalidSchedule / invalidDue', () => {
    assert.deepEqual(checkContent(event({ kind: 'timed', start: '2026-10-02T15:00:00+09:00', end: '2026-10-02T07:00:00Z', timeZone: 'Asia/Seoul' })), ['invalidSchedule']);
    assert.deepEqual(checkContent(event({ kind: 'timed', start: '2026-10-02T06:00:00Z', end: '2026-10-02T07:00:00Z', timeZone: 'Seoul' })), ['invalidSchedule']);
    assert.deepEqual(checkContent(task({ due: { kind: 'date', date: '2026-02-30' } })), ['invalidDue']);
    assert.deepEqual(checkContent(task({ completedAt: '어제' })), ['invalidCompletedAt']);
  });

  test('[임시 가정] 공백뿐인 제목·본문은 받지 않는다', () => {
    assert.deepEqual(checkContent(task({ title: '   ' })), ['emptyTitle']);
    assert.deepEqual(checkContent(memo(' \n ')), ['emptyBody']);
  });

  test('AI 출처는 후보 ID가 있어야 하고 근거 위치 모양이 맞아야 한다', () => {
    assert.deepEqual(checkContent(task({ provenance: ai('autoSaved') })), []);
    assert.deepEqual(checkContent(task({ provenance: { ...ai('autoSaved'), candidateId: '' } as Provenance })), ['invalidProvenance']);
    const badEvidence = { ...ai('autoSaved'), evidence: [{ kind: 'text', sourceId: 'src-1', sourceVersion: 1, start: 4, end: 4 }] } as Provenance;
    assert.deepEqual(checkContent(task({ provenance: badEvidence })), ['invalidProvenance']);
  });
});

describe('DTL-SET-009 AI 생성 배지', () => {
  test('자동 저장된 AI 항목에만 붙는다', () => {
    assert.equal(showsAiBadge({ provenance: ai('autoSaved') }), true);
    assert.equal(showsAiBadge({ provenance: ai('userConfirmed') }), false);
    assert.equal(showsAiBadge({ provenance: manual }), false);
  });
});

describe('단계 3 일정의 반복·알림 검사(DTL-CAL-003)', () => {
  const base = event({ kind: 'timed', start: '2026-10-02T06:00:00Z', end: '2026-10-02T07:00:00Z', timeZone: 'Asia/Seoul' });

  test('매주·매월 반복과 0분 이상 정수 알림은 받는다', () => {
    assert.deepEqual(checkContent({ ...base, recurrence: { freq: 'weekly' }, reminder: { minutesBefore: 10 } }), []);
    assert.deepEqual(checkContent({ ...base, recurrence: { freq: 'monthly' }, reminder: { minutesBefore: 0 } }), []);
  });

  test('모르는 반복(JSON으로 들어온 daily 등)은 invalidRecurrence', () => {
    const daily = { ...base, recurrence: { freq: 'daily' } } as unknown as EventContent;
    assert.deepEqual(checkContent(daily), ['invalidRecurrence']);
  });

  test('음수·소수·숫자가 아닌 알림은 invalidReminder', () => {
    for (const minutesBefore of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(checkContent({ ...base, reminder: { minutesBefore } }), ['invalidReminder'], String(minutesBefore));
    }
  });
});
