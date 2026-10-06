import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { canLeave, canRemove, initialMembers, unassignDeparted, type Member } from './membership.ts';

const admin = (userId: string): Member => ({ userId, role: 'admin' });
const member = (userId: string): Member => ({ userId, role: 'member' });

describe('REQ-TEM-001 워크스페이스를 만든 사람', () => {
  test('관리자가 된다', () => {
    assert.deepEqual(initialMembers('u1'), [{ userId: 'u1', role: 'admin' }]);
  });
});

describe('REQ-TEM-009·ACC-006 나가기·탈퇴', () => {
  test('마지막 관리자는 관리자 역할을 넘기기 전에는 나갈 수 없다', () => {
    assert.deepEqual(canLeave([admin('a'), member('b')], 'a'), { allowed: false, reason: 'transferAdminFirst' });
  });

  test('다른 관리자가 있으면 나갈 수 있다', () => {
    assert.deepEqual(canLeave([admin('a'), admin('b'), member('c')], 'a'), { allowed: true, lastMemberLeaving: false });
  });

  test('관리자가 아니면 나갈 수 있다', () => {
    assert.deepEqual(canLeave([admin('a'), member('b')], 'b'), { allowed: true, lastMemberLeaving: false });
  });

  test('혼자 남은 사람은 막지 않고 마지막 사람이라고 알린다', () => {
    assert.deepEqual(canLeave([admin('a')], 'a'), { allowed: true, lastMemberLeaving: true });
  });

  test('구성원이 아니면 알린다', () => {
    assert.deepEqual(canLeave([admin('a')], 'z'), { allowed: false, reason: 'notMember' });
  });
});

describe('REQ-TEM-008 내보내기', () => {
  const team = [admin('a'), member('b'), member('c')];

  test('관리자만 내보낼 수 있다', () => {
    assert.deepEqual(canRemove(team, 'a', 'b'), { allowed: true });
    assert.deepEqual(canRemove(team, 'b', 'c'), { allowed: false, reason: 'notAdmin' });
  });

  test('자기 자신은 내보내기가 아니라 나가기다', () => {
    assert.deepEqual(canRemove(team, 'a', 'a'), { allowed: false, reason: 'useLeave' });
  });

  test('관리자가 둘이면 다른 관리자를 내보낼 수 있다', () => {
    assert.deepEqual(canRemove([admin('a'), admin('b')], 'a', 'b'), { allowed: true });
  });
});

describe('REQ-TEM-010 나간 뒤 할 일 처리', () => {
  test('나간 사람이 맡던 할 일만 담당자 미지정으로 바꾸고 id를 알린다', () => {
    const tasks = [
      { id: 't1', assigneeId: 'b', title: '보고서' },
      { id: 't2', assigneeId: 'c', title: '회의 준비' },
      { id: 't3', assigneeId: 'b', title: '발표' },
    ];
    const r = unassignDeparted(tasks, 'b');
    assert.deepEqual(r.unassignedIds, ['t1', 't3']);
    assert.deepEqual(r.tasks.map((t) => t.assigneeId), [null, 'c', null]);
    assert.equal(r.tasks[0]?.title, '보고서', '다른 칸은 그대로 둔다');
    assert.equal(tasks[0]?.assigneeId, 'b', '원래 목록은 바꾸지 않는다');
  });
});
