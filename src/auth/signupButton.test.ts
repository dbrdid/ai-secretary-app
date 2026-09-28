import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_CHECK_IDLE,
  type EmailCheckState,
  type SignupFormState,
  canSubmitSignup,
  needsEmailCheck,
  resolveEmailCheck,
  signupBlockers,
  startEmailCheck,
} from './signupButton.ts';
import type { SignupValues } from './signupRules.ts';
import { setAllTerms, setTerm } from './terms.ts';

const values: SignupValues = {
  email: 'kim@example.com',
  password: 'abcd12!@',
  passwordConfirm: 'abcd12!@',
  name: '김민수',
  organization: '에이비 주식회사',
};

function readyForm(overrides: Partial<SignupFormState> = {}): SignupFormState {
  return {
    values,
    terms: setTerm(setAllTerms(true), 'marketing', false),
    emailCheck: { status: 'available', email: 'kim@example.com' },
    ...overrides,
  };
}

describe('DTL-AUT-016 가입 버튼 활성화 조건', () => {
  test('모든 필수 필드가 유효하고 필수 약관 3개에 동의하면 켠다(선택 약관은 상관없음)', () => {
    assert.deepEqual(signupBlockers(readyForm()), []);
    assert.equal(canSubmitSignup(readyForm()), true);
  });

  test('필수 약관 하나라도 빠지면 끈다', () => {
    const form = readyForm({ terms: setTerm(setAllTerms(true), 'age14', false) });
    assert.deepEqual(signupBlockers(form), ['requiredTerms']);
    assert.equal(canSubmitSignup(form), false);
  });

  test('필수 필드 하나라도 무효면 끈다', () => {
    const cases: Array<[Partial<SignupValues>, string]> = [
      [{ password: 'abcd1234', passwordConfirm: 'abcd1234' }, 'password'],
      [{ passwordConfirm: 'abcd12!#' }, 'passwordConfirm'],
      [{ name: '김' }, 'name'],
      [{ organization: '' }, 'organization'],
    ];
    for (const [patch, blocker] of cases) {
      const form = readyForm({ values: { ...values, ...patch } });
      assert.deepEqual(signupBlockers(form), [blocker], blocker);
    }
  });

  test('처음 빈 폼에서는 끈다', () => {
    const empty: SignupValues = { email: '', password: '', passwordConfirm: '', name: '', organization: '' };
    const form = readyForm({ values: empty, terms: setAllTerms(false), emailCheck: EMAIL_CHECK_IDLE });
    assert.equal(canSubmitSignup(form), false);
  });

  test('[임시 가정] 중복 확인이 끝나 사용 가능이어야 켠다: 확인 전·확인 중·중복·실패는 끈다', () => {
    const states: EmailCheckState[] = [
      EMAIL_CHECK_IDLE,
      { status: 'checking', email: 'kim@example.com' },
      { status: 'duplicate', email: 'kim@example.com' },
      { status: 'failed', email: 'kim@example.com' },
    ];
    for (const emailCheck of states) {
      assert.deepEqual(signupBlockers(readyForm({ emailCheck })), ['emailCheck'], emailCheck.status);
    }
  });

  test('사용 가능을 받은 뒤 이메일을 고치면 예전 결과로는 켜지지 않는다', () => {
    const form = readyForm({ values: { ...values, email: 'lee@example.com' } });
    assert.deepEqual(signupBlockers(form), ['emailCheck']);
  });

  test('대소문자·앞뒤 공백만 다른 이메일은 같은 이메일로 본다(DTL-AUT-003 정규화)', () => {
    const form = readyForm({ values: { ...values, email: '  KIM@Example.com ' } });
    assert.equal(canSubmitSignup(form), true);
  });
});

describe('DTL-AUT-004 중복 확인 결과를 이메일에 묶기 (DTL-AUT-016 보조)', () => {
  test('늦게 도착한 예전 이메일의 응답은 버린다', () => {
    let state = startEmailCheck('kim@example.com');
    state = startEmailCheck('lee@example.com'); // 사용자가 이메일을 고치고 다시 Blur
    state = resolveEmailCheck(state, 'kim@example.com', 'available');
    assert.deepEqual(state, { status: 'checking', email: 'lee@example.com' });
    state = resolveEmailCheck(state, 'lee@example.com', 'duplicate');
    assert.deepEqual(state, { status: 'duplicate', email: 'lee@example.com' });
  });

  test('확인 중이 아닐 때 온 응답은 버린다', () => {
    assert.deepEqual(resolveEmailCheck(EMAIL_CHECK_IDLE, 'kim@example.com', 'available'), EMAIL_CHECK_IDLE);
  });

  test('다시 확인할지: 형식이 틀리면 안 하고, 새 이메일이거나 실패했으면 한다', () => {
    assert.equal(needsEmailCheck('kim@example', EMAIL_CHECK_IDLE), false);
    assert.equal(needsEmailCheck('kim@example.com', EMAIL_CHECK_IDLE), true);
    assert.equal(needsEmailCheck('kim@example.com', { status: 'available', email: 'kim@example.com' }), false);
    assert.equal(needsEmailCheck('kim@example.com', { status: 'checking', email: 'kim@example.com' }), false);
    assert.equal(needsEmailCheck('KIM@example.com ', { status: 'duplicate', email: 'kim@example.com' }), false);
    assert.equal(needsEmailCheck('lee@example.com', { status: 'available', email: 'kim@example.com' }), true);
    assert.equal(needsEmailCheck('kim@example.com', { status: 'failed', email: 'kim@example.com' }), true);
  });
});
