/**
 * 로그인 화면 키보드 제출 — DTL-AUT-030.
 * 원문: 이메일 필드에서 Enter → 비밀번호 필드로 포커스 이동, 비밀번호 필드에서 Enter → 로그인 실행.
 *
 * '로그인 실행'은 [로그인] 버튼과 같은 제출 함수를 부르는 것으로 본다. 그래야 빈 값 검사
 * (DTL-AUT-031)와 중복 제출 방지(DTL-AUT-017)가 버튼과 똑같이 걸린다. 그래서 여기서는 따로
 * 검사하거나 막지 않는다.
 */

import { type KeyInput, isPlainEnter } from '../shared/keyboard.ts';

export type LoginField = 'email' | 'password';

export type LoginEnterAction = 'none' | 'focusPassword' | 'submit';

export function loginEnterAction(field: LoginField, event: KeyInput): LoginEnterAction {
  if (!isPlainEnter(event)) return 'none';
  return field === 'email' ? 'focusPassword' : 'submit';
}

export type LoginKeyHandlers = {
  focusPassword(): void;
  /** [로그인] 버튼이 부르는 것과 같은 함수를 넘긴다. */
  submit(): void;
};

/**
 * keydown 처리기. 처리한 Enter는 preventDefault 한다 — <form> 안의 Enter는 브라우저가 폼을
 * 스스로 제출하므로, 막지 않으면 이메일 칸에서 Enter만 쳐도 제출되거나 두 번 제출된다.
 */
export function handleLoginKeyDown(
  field: LoginField,
  event: KeyInput & { preventDefault(): void },
  handlers: LoginKeyHandlers,
): LoginEnterAction {
  const action = loginEnterAction(field, event);
  if (action === 'none') return action;
  event.preventDefault();
  if (action === 'focusPassword') handlers.focusPassword();
  else handlers.submit();
  return action;
}
