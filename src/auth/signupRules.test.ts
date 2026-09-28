// 검증(Val) 분류 규칙의 테스트. 담당 밖 규칙이지만 가입 버튼 계산(DTL-AUT-016)이 기대므로
// 원문대로 옮겼는지 확인한다. [해석]은 원문이 정하지 않아 MyClaw가 고른 동작이다.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGES,
  checkEmail,
  checkName,
  checkOrganization,
  checkPassword,
  checkPasswordConfirm,
  normalizeEmail,
  passwordChecklist,
} from './signupRules.ts';

describe('DTL-AUT-003 이메일 형식 검사', () => {
  test('앞뒤 공백을 지우고 소문자로 바꾼 뒤 검사한다', () => {
    assert.equal(normalizeEmail('  Kim.Minsu@Example.COM '), 'kim.minsu@example.com');
    assert.deepEqual(checkEmail('  Kim.Minsu@Example.COM '), { valid: true });
  });

  test('아이디@도메인.최상위도메인 형식이 아니면 원문 문구를 낸다', () => {
    for (const bad of ['kim', 'kim@example', 'kim@.com', 'kim@example.', '@example.com', 'kim minsu@example.com', 'kim@@example.com']) {
      assert.deepEqual(checkEmail(bad), { valid: false, message: MESSAGES.emailFormat }, bad);
    }
  });

  test('254자까지 받고 255자부터 거부한다', () => {
    const at254 = `${'a'.repeat(64)}@${'b'.repeat(185)}.com`;
    assert.equal(at254.length, 254);
    assert.equal(checkEmail(at254).valid, true);
    assert.equal(checkEmail(`a${at254}`).valid, false);
  });

  test('비어 있으면 무효지만 형식 문구는 붙이지 않는다', () => {
    assert.deepEqual(checkEmail('   '), { valid: false });
  });
});

describe('DTL-AUT-006·007 비밀번호 복잡도', () => {
  const email = 'kim@example.com';

  test('8자이고 영문·숫자·특수문자가 모두 있으면 유효', () => {
    assert.deepEqual(checkPassword('abcd12!@', email), { valid: true });
  });

  test('7자는 무효, 64자는 유효, 65자는 무효', () => {
    assert.equal(checkPassword('abc12!@', email).valid, false);
    assert.equal(checkPassword(`a1!${'x'.repeat(61)}`, email).valid, true);
    assert.equal(checkPassword(`a1!${'x'.repeat(62)}`, email).valid, false);
  });

  test('영문·숫자·특수문자 가운데 하나라도 없으면 무효', () => {
    assert.equal(checkPassword('12345678!', email).valid, false);
    assert.equal(checkPassword('abcdefgh!', email).valid, false);
    assert.equal(checkPassword('abcd1234', email).valid, false);
  });

  test('공백이 있으면 무효', () => {
    assert.equal(checkPassword('abcd 12!@', email).valid, false);
  });

  test('체크리스트 네 항목이 조건별로 따로 켜진다', () => {
    assert.deepEqual(passwordChecklist('ab1'), { minLength: false, hasLetter: true, hasDigit: true, hasSpecial: false });
    assert.deepEqual(passwordChecklist('abcdefgh!'), { minLength: true, hasLetter: true, hasDigit: false, hasSpecial: true });
  });
});

describe('DTL-AUT-009 이메일 아이디 포함 금지', () => {
  test('@ 앞부분이 4자 이상이고 비밀번호에 들어 있으면 원문 문구를 낸다', () => {
    assert.deepEqual(checkPassword('xminsu12!', 'minsu@example.com'), {
      valid: false,
      message: MESSAGES.passwordContainsEmailId,
    });
  });

  test('@ 앞부분이 3자면 비밀번호에 들어 있어도 막지 않는다', () => {
    assert.deepEqual(checkPassword('kim12345!', 'kim@example.com'), { valid: true });
  });

  test('[해석] 정규화한(소문자) 아이디가 글자 그대로 들어 있을 때만 막는다', () => {
    assert.deepEqual(checkPassword('Minsu123!', 'minsu@example.com'), { valid: true });
    assert.equal(checkPassword('minsu123!', 'MINSU@example.com').valid, false);
  });
});

describe('DTL-AUT-008 비밀번호 확인 일치', () => {
  test('다르면 원문 문구를 낸다', () => {
    assert.deepEqual(checkPasswordConfirm('abcd12!@', 'abcd12!#'), { valid: false, message: MESSAGES.passwordMismatch });
  });

  test('같으면 유효, 비어 있으면 문구 없이 무효', () => {
    assert.deepEqual(checkPasswordConfirm('abcd12!@', 'abcd12!@'), { valid: true });
    assert.deepEqual(checkPasswordConfirm('abcd12!@', ''), { valid: false });
  });
});

describe('DTL-AUT-011 이름 검증', () => {
  test('한글·영문·공백으로 2~20자면 유효', () => {
    for (const ok of ['홍길동', '  김민수  ', 'Kim Minsu', '가'.repeat(20)]) {
      assert.deepEqual(checkName(ok), { valid: true }, ok);
    }
  });

  test('앞뒤 공백을 뺀 뒤 1자이거나 21자이거나 숫자·기호가 있으면 원문 문구를 낸다', () => {
    for (const bad of [' 홍 ', 'A', '가'.repeat(21), '홍길동1', 'Kim_Minsu']) {
      assert.deepEqual(checkName(bad), { valid: false, message: MESSAGES.name }, bad);
    }
  });

  test('[해석] 완성되지 않은 자모(ㄱ, ㅏ)는 한글로 치지 않는다', () => {
    assert.equal(checkName('ㄱㄴㄷ').valid, false);
  });
});

describe('DTL-AUT-012 소속 검증', () => {
  test('비어 있으면 원문 문구를 낸다', () => {
    assert.deepEqual(checkOrganization(''), { valid: false, message: MESSAGES.organizationRequired });
  });

  test('[해석] 공백만 있으면 비어 있는 것으로 본다', () => {
    assert.deepEqual(checkOrganization('   '), { valid: false, message: MESSAGES.organizationRequired });
  });

  test('1자와 50자는 유효, 51자는 무효', () => {
    assert.equal(checkOrganization('A').valid, true);
    assert.equal(checkOrganization('가'.repeat(50)).valid, true);
    assert.deepEqual(checkOrganization('가'.repeat(51)), { valid: false });
  });
});
