/**
 * 워크스페이스 나가기와 나간 뒤 처리 — REQ-TEM-009(나가기), REQ-TEM-008(내보내기), REQ-TEM-010(나간 뒤 데이터 처리),
 * REQ-ACC-006(회원 탈퇴 시 마지막 관리자), REQ-TEM-001(만든 사람이 관리자).
 * 원문
 * - REQ-TEM-001: 워크스페이스를 만든 사용자가 관리자가 된다.
 * - REQ-TEM-009·ACC-006: 마지막 남은 관리자는 다른 팀원에게 관리자 역할을 넘긴 뒤에만 나가거나 탈퇴할 수 있다.
 * - REQ-TEM-010: 나가거나 내보내진 팀원이 조직에 공유한 기록은 남고, 맡던 할 일은 담당자 미지정으로 바뀌어 관리자에게 알려진다.
 *
 * 결정과 이유
 * - 역할 종류는 명세서에서 아직 임시안(관리자·멤버·보기 전용, REQ-TEM-006)이다. 그래서 여기서는 '관리자인지'만 본다.
 *   관리자 아닌 역할의 이름과 권한 범위(REQ-TEM-007)는 팀이 정한 뒤 더한다(docs/open-decisions.md OD-25).
 * - [해석] 혼자 남은 관리자(팀원이 아무도 없음)는 넘길 사람이 없다. 원문은 이 경우를 말하지 않는다. 막으면 영영 나갈 수
 *   없으므로 막지 않고 'lastMemberLeaving'으로 알려, 워크스페이스를 어떻게 할지(삭제 등) 화면이 묻게 한다.
 * - 내보내기(REQ-TEM-008)는 관리자만 할 수 있다. 자기 자신을 내보내는 것은 나가기다.
 */

/** 임시: 명세서가 역할 종류를 확정하면 이 타입을 넓힌다. 지금 규칙은 'admin'만 구별한다. */
export type WorkspaceRole = 'admin' | (string & {});

export type Member = { readonly userId: string; readonly role: WorkspaceRole };

const isAdmin = (m: Member) => m.role === 'admin';

/** REQ-TEM-001: 만든 사람을 관리자로 하는 첫 구성원 목록. */
export function initialMembers(creatorId: string): readonly Member[] {
  return [{ userId: creatorId, role: 'admin' }];
}

export type LeaveCheck =
  | { readonly allowed: true; readonly lastMemberLeaving: boolean }
  /** 다른 팀원에게 관리자 역할을 먼저 넘겨야 한다. */
  | { readonly allowed: false; readonly reason: 'transferAdminFirst' }
  | { readonly allowed: false; readonly reason: 'notMember' };

/** REQ-TEM-009·ACC-006: 이 사용자가 지금 나갈(또는 탈퇴할) 수 있는지. */
export function canLeave(members: readonly Member[], userId: string): LeaveCheck {
  const me = members.find((m) => m.userId === userId);
  if (me === undefined) return { allowed: false, reason: 'notMember' };
  const others = members.filter((m) => m.userId !== userId);
  if (others.length === 0) return { allowed: true, lastMemberLeaving: true };
  if (isAdmin(me) && !others.some(isAdmin)) return { allowed: false, reason: 'transferAdminFirst' };
  return { allowed: true, lastMemberLeaving: false };
}

export type RemoveCheck = { readonly allowed: true } | { readonly allowed: false; readonly reason: 'notAdmin' | 'notMember' | 'useLeave' };

/**
 * REQ-TEM-008: 관리자가 팀원을 내보낼 수 있는지. 내보내는 사람이 관리자이고 자기 자신이 아니므로, 관리자를 내보내도 관리자가
 * 적어도 한 명(내보내는 사람) 남는다. 그래서 마지막 관리자 검사는 따로 필요 없다.
 */
export function canRemove(members: readonly Member[], actorId: string, targetId: string): RemoveCheck {
  const actor = members.find((m) => m.userId === actorId);
  const target = members.find((m) => m.userId === targetId);
  if (actor === undefined || target === undefined) return { allowed: false, reason: 'notMember' };
  if (!isAdmin(actor)) return { allowed: false, reason: 'notAdmin' };
  if (actorId === targetId) return { allowed: false, reason: 'useLeave' };
  return { allowed: true };
}

/** 담당자 칸만 보는 할 일 모양. contracts/items.ts의 TaskContent와 같은 이름이다. */
type Assignable = { readonly id: string; readonly assigneeId: string | null };

/**
 * REQ-TEM-010: 나간 팀원이 맡던 할 일을 담당자 미지정으로 바꾼다. 바뀐 할 일 id를 함께 돌려줘 관리자 알림에 쓴다.
 * 기록(메모·녹음·문서)은 건드리지 않는다 — 워크스페이스에 남는다.
 */
export function unassignDeparted<T extends Assignable>(tasks: readonly T[], departedUserId: string): { readonly tasks: readonly T[]; readonly unassignedIds: readonly string[] } {
  const unassignedIds: string[] = [];
  const next = tasks.map((t) => {
    if (t.assigneeId !== departedUserId) return t;
    unassignedIds.push(t.id);
    return { ...t, assigneeId: null };
  });
  return { tasks: next, unassignedIds };
}
