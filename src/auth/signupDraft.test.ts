import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { type DraftStore, type SignupDraft, createMemoryDraftStore, restoreSignupForm, saveSignupDraft } from './signupDraft.ts';
import type { SignupValues } from './signupRules.ts';
import { EMPTY_TERMS, setTerm } from './terms.ts';

const PASSWORD = 'Secret12!@';
const CONFIRM = 'Secret12!#';
const values: SignupValues = {
  email: 'kim@example.com',
  password: PASSWORD,
  passwordConfirm: CONFIRM,
  name: '김민수',
  organization: '에이비 주식회사',
};

/** 저장소에 실제로 넘어간 것을 모두 기록한다. */
function recordingStore(): DraftStore & { saved: SignupDraft[] } {
  const inner = createMemoryDraftStore();
  const saved: SignupDraft[] = [];
  return {
    saved,
    load: () => inner.load(),
    save: (draft) => {
      saved.push(draft);
      inner.save(draft);
    },
    clear: () => inner.clear(),
  };
}

describe('DTL-AUT-020 입력값 유지', () => {
  test('약관 모달·뒤로가기로 떠났다 돌아오면 이메일·이름·소속을 되살린다', () => {
    const store = createMemoryDraftStore();
    saveSignupDraft(store, values, EMPTY_TERMS);
    const { values: restored } = restoreSignupForm(store);
    assert.equal(restored.email, values.email);
    assert.equal(restored.name, values.name);
    assert.equal(restored.organization, values.organization);
  });

  test('비밀번호와 비밀번호 확인은 되살리지 않는다(빈 값)', () => {
    const store = createMemoryDraftStore();
    saveSignupDraft(store, values, EMPTY_TERMS);
    const { values: restored } = restoreSignupForm(store);
    assert.equal(restored.password, '');
    assert.equal(restored.passwordConfirm, '');
  });

  test('비밀번호 값은 저장소에 아예 넘어가지 않는다', () => {
    const store = recordingStore();
    saveSignupDraft(store, values, EMPTY_TERMS);
    assert.equal(store.saved.length, 1);
    const dump = JSON.stringify(store.saved);
    assert.equal(dump.includes(PASSWORD), false);
    assert.equal(dump.includes(CONFIRM), false);
    assert.deepEqual(Object.keys(store.saved[0] ?? {}).sort(), ['email', 'name', 'organization', 'terms']);
  });

  test('폼 상태에 다른 값이 섞여 들어와도 고른 필드만 저장한다', () => {
    const store = recordingStore();
    const polluted = { ...values, passwordHint: PASSWORD } as SignupValues;
    saveSignupDraft(store, polluted, EMPTY_TERMS);
    assert.equal(JSON.stringify(store.saved).includes(PASSWORD), false);
  });

  test('[임시 가정] 약관 체크 상태도 함께 되살린다', () => {
    const store = createMemoryDraftStore();
    const terms = setTerm(setTerm(EMPTY_TERMS, 'age14', true), 'marketing', true);
    saveSignupDraft(store, values, terms);
    assert.deepEqual(restoreSignupForm(store).terms, terms);
  });

  test('저장한 적이 없거나 지운 뒤에는 빈 폼을 준다', () => {
    const store = createMemoryDraftStore();
    const empty = { email: '', password: '', passwordConfirm: '', name: '', organization: '' };
    assert.deepEqual(restoreSignupForm(store), { values: empty, terms: EMPTY_TERMS });
    saveSignupDraft(store, values, EMPTY_TERMS);
    store.clear();
    assert.deepEqual(restoreSignupForm(store), { values: empty, terms: EMPTY_TERMS });
  });

  test('되살린 값을 고쳐도 저장된 값은 바뀌지 않는다', () => {
    const store = createMemoryDraftStore();
    saveSignupDraft(store, values, EMPTY_TERMS);
    const loaded = store.load() as { email: string };
    loaded.email = 'changed@example.com';
    assert.equal(store.load()?.email, values.email);
  });
});
