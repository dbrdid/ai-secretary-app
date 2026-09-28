import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { type LoginField, handleLoginKeyDown, loginEnterAction } from './loginKeyboard.ts';

function press(field: LoginField, init: { key: string; isComposing?: boolean; keyCode?: number }) {
  const calls: string[] = [];
  const event = { ...init, preventDefault: () => calls.push('preventDefault') };
  const action = handleLoginKeyDown(field, event, {
    focusPassword: () => calls.push('focusPassword'),
    submit: () => calls.push('submit'),
  });
  return { action, calls };
}

describe('DTL-AUT-030 키보드 제출', () => {
  test('이메일 필드에서 Enter → 비밀번호 필드로 포커스 이동(제출하지 않음)', () => {
    assert.deepEqual(press('email', { key: 'Enter' }), { action: 'focusPassword', calls: ['preventDefault', 'focusPassword'] });
  });

  test('비밀번호 필드에서 Enter → 로그인 버튼과 같은 제출 함수 호출', () => {
    assert.deepEqual(press('password', { key: 'Enter' }), { action: 'submit', calls: ['preventDefault', 'submit'] });
  });

  test('Enter가 아닌 키는 아무것도 하지 않고 기본 동작도 막지 않는다', () => {
    for (const key of ['Tab', 'a', 'Escape']) {
      assert.deepEqual(press('password', { key }), { action: 'none', calls: [] }, key);
    }
  });

  test('[보완] 한글 조합 중 Enter는 글자 확정이므로 이동·제출하지 않는다', () => {
    assert.deepEqual(press('password', { key: 'Enter', isComposing: true }), { action: 'none', calls: [] });
    assert.deepEqual(press('email', { key: 'Enter', isComposing: true }), { action: 'none', calls: [] });
  });

  test('[보완] 조합을 끝내는 Enter가 keyCode 229로 와도(Safari 등) 제출하지 않는다', () => {
    assert.equal(loginEnterAction('password', { key: 'Enter', isComposing: false, keyCode: 229 }), 'none');
    assert.equal(loginEnterAction('password', { key: 'Enter', isComposing: false, keyCode: 13 }), 'submit');
  });
});
