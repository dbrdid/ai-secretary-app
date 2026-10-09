/**
 * 누른 뒤 60초 대기 — DTL-AUT-026(인증번호 [재발송]), DTL-AUT-049(비밀번호 재설정 [인증번호 받기]).
 * 두 항목 모두 원문이 "60초간 버튼을 비활성화하고 버튼에 남은 초를 표시"라서 같은 계산을 쓴다.
 *
 * 시각은 밀리초 숫자로 주입받는다. 화면에서는 performance.now()처럼 거꾸로 가지 않는 시계를
 * 넘긴다. Date.now()는 기기 시각을 바꾸면 남은 초가 튄다. performance.now()는 새로고침하면
 * 0부터 다시 세므로 대기 상태도 새로고침하면 풀린다 — 그래서 남용을 막는 것은 서버 쪽 제한이다.
 *
 * 60초는 버튼을 누른 시각부터 센다(원문대로). 발송 요청이 실패해도 대기를 풀지 않는다. 실패 때
 * 대기를 풀지는 원문에 없어 팀 확인 대상이다.
 * DTL-AUT-026 뒷문장의 "1시간에 최대 5회"는 여기서 다루지 않는다. 서버가 세야 하는 값이라
 * auth/verificationCode.ts의 tryResend에 두었다.
 */

export const COOLDOWN_MS = 60_000;

export type Cooldown = { readonly endsAt: number | null };

export const COOLDOWN_READY: Cooldown = { endsAt: null };

/** 버튼에 표시할 남은 초. 누른 직후 60, 마지막 1초 동안 1, 60초가 지나면 0. */
export function remainingSeconds(cooldown: Cooldown, now: number): number {
  if (cooldown.endsAt === null) return 0;
  const leftMs = cooldown.endsAt - now;
  return leftMs > 0 ? Math.ceil(leftMs / 1000) : 0;
}

export function isCoolingDown(cooldown: Cooldown, now: number): boolean {
  return remainingSeconds(cooldown, now) > 0;
}

/**
 * 버튼을 누른다. 대기 중이면 받지 않는다(accepted=false). 버튼이 비활성으로 다시 그려지기 전에
 * 들어온 두 번째 클릭(더블 클릭)도 여기서 걸러진다. accepted가 true일 때만 발송 요청을 보낸다.
 */
export function press(cooldown: Cooldown, now: number): { accepted: boolean; cooldown: Cooldown } {
  if (isCoolingDown(cooldown, now)) return { accepted: false, cooldown };
  return { accepted: true, cooldown: { endsAt: now + COOLDOWN_MS } };
}
