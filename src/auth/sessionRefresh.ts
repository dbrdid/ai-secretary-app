import type { RefreshResult, SessionApi } from './session.ts';

/**
 * 토큰 회전 요청끼리 충돌하지 않도록 진행 중인 Promise만 공유한다(OD-25).
 * 세션/브라우저 컨텍스트마다 한 번 만들고 restoreSession(wrapper, tokens)과
 * 향후 refresh 호출 모두에 같은 wrapper를 전달해야 한다. 호출마다 만들면 중복을 막지 못한다.
 *
 * 로그인/로그아웃 경계에서는 별도 token holder와 wrapper로 교체하고 소비자가
 * 이전 세션 결과를 무시해야 한다. 이 wrapper만으로 오래된 응답의 새 세션 기록을
 * 막지는 못한다. disposal/취소는 별도 세션 수명주기 작업이며 여기서는 구현하지 않는다.
 */
export function createSingleFlightSessionApi(api: SessionApi): SessionApi {
  let pending: Promise<RefreshResult> | undefined;
  return {
    // async 함수로 감싸면 Promise identity가 달라지므로 pending을 그대로 반환한다.
    refresh() {
      if (!pending) {
        pending = Promise.resolve()
          .then(() => api.refresh())
          // 동기 throw와 reject 모두 같은 계약으로 정규화하며 오류 내용은 노출하지 않는다.
          .catch((): RefreshResult => ({ ok: false, reason: 'network' }))
          .finally(() => {
            // 호출자의 await/then보다 먼저 해제해야 순차 재발급이 이전 결과를 재사용하지 않는다.
            pending = undefined;
          });
      }
      return pending;
    },
  };
}
