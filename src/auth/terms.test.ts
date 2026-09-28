import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_TERMS, isAllAgreed, requiredTermsAgreed, setAllTerms, setTerm } from './terms.ts';

describe('DTL-AUT-014 전체 동의 연동', () => {
  test('[전체 동의]를 체크하면 하위 4개가 모두 체크된다', () => {
    const terms = setAllTerms(true);
    assert.deepEqual(terms, { age14: true, service: true, privacy: true, marketing: true });
    assert.equal(isAllAgreed(terms), true);
  });

  test('[전체 동의]를 해제하면 하위 4개가 모두 해제된다', () => {
    const terms = setAllTerms(false);
    assert.deepEqual(terms, EMPTY_TERMS);
    assert.equal(isAllAgreed(terms), false);
  });

  test('하위 항목을 하나라도 해제하면 전체 동의가 자동 해제되고 나머지는 그대로다', () => {
    const terms = setTerm(setAllTerms(true), 'privacy', false);
    assert.equal(isAllAgreed(terms), false);
    assert.deepEqual(terms, { age14: true, service: true, privacy: false, marketing: true });
  });

  test('하위 항목을 하나씩 모두 체크하면 전체 동의가 자동 체크된다', () => {
    let terms = EMPTY_TERMS;
    for (const key of ['age14', 'service', 'privacy'] as const) {
      terms = setTerm(terms, key, true);
      assert.equal(isAllAgreed(terms), false);
    }
    terms = setTerm(terms, 'marketing', true);
    assert.equal(isAllAgreed(terms), true);
  });

  test('필수 3개만 체크하면 필수 동의는 충족이지만 전체 동의는 아니다(선택 항목 미체크)', () => {
    let terms = EMPTY_TERMS;
    terms = setTerm(terms, 'age14', true);
    terms = setTerm(terms, 'service', true);
    terms = setTerm(terms, 'privacy', true);
    assert.equal(requiredTermsAgreed(terms), true);
    assert.equal(isAllAgreed(terms), false);
  });

  test('DTL-AUT-015 약관 모달의 [동의]로 마지막 항목을 체크해도 전체 동의가 체크된다', () => {
    const before = setTerm(setAllTerms(true), 'service', false);
    const after = setTerm(before, 'service', true);
    assert.equal(isAllAgreed(after), true);
  });

  test('상태를 바꿀 때 원래 객체는 그대로 둔다', () => {
    const before = setAllTerms(true);
    setTerm(before, 'age14', false);
    assert.equal(before.age14, true);
  });
});
