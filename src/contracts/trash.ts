/**
 * 휴지통 보관 기간 — REQ-SYS-001, DTL-SYS-001("30일 이내에 복원하거나 영구 삭제할 수 있다").
 *
 * - 30은 DTL-SYS-001 원문 값이다. 시트가 '상세 설계 단계 확정 필요' 상태라 호출하는 쪽에서 바꿀 수 있게
 *   인자로 받는다.
 * - [해석] 30일은 휴지통으로 옮긴 순간부터 30×24시간이다. 사용자 시간대의 날짜로 세면 시간대를 바꿀 때
 *   만료 시각이 흔들린다. 원문은 세는 기준을 정하지 않았다(팀 확인 대상).
 * - 만료 시각 정각부터는 복원을 받지 않는다(30일 '이내'). 실제 파기(첨부 파일·검색 색인 포함)는 서버
 *   예약 작업이 한다.
 */
import { instantMs, toInstant, type Instant } from './time.ts';

export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 이 시각부터 복원할 수 없고 서버가 파기한다. 휴지통 화면의 남은 기간 표시에도 쓴다. */
export function purgeDueAt(deletedAt: Instant, retentionDays: number = TRASH_RETENTION_DAYS): Instant {
  return toInstant(instantMs(deletedAt) + retentionDays * DAY_MS);
}

export function isRestorable(deletedAt: Instant, now: Instant, retentionDays: number = TRASH_RETENTION_DAYS): boolean {
  return instantMs(now) < instantMs(deletedAt) + retentionDays * DAY_MS;
}
