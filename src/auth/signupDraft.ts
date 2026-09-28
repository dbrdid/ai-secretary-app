/**
 * 회원가입 입력값 유지 — DTL-AUT-020.
 * 원문: 약관 모달을 열고 닫거나 뒤로가기 후 다시 돌아와도 입력값을 유지한다. 단, 비밀번호와
 * 비밀번호 확인 값은 보안상 유지하지 않는다.
 *
 * 보관할 필드를 '빼는' 대신 '골라 담는' 방식(허용 목록)으로 적었다. 나중에 가입 폼에 필드가
 * 늘거나 폼 상태에 다른 값이 섞여 들어와도 비밀번호류가 저장소로 새지 않게 하려는 것이다.
 *
 * [임시 가정] 약관 체크 상태도 입력값으로 보고 함께 유지한다.
 *
 * 저장소는 주입한다. 기본 제공은 메모리 저장소다(새로고침하면 사라짐). 웹/앱 결정(D2)과 라우터
 * 구조를 본 뒤 sessionStorage 등으로 바꿀지 정한다. 어느 저장소든 비밀번호는 넘어가지 않는다.
 *
 * 연결할 때: 화면을 떠날 때(약관 모달 열기, 뒤로가기) saveSignupDraft를, 돌아왔을 때
 * restoreSignupForm을 부른다. 복원 뒤에는 needsEmailCheck(signupButton.ts)로 중복 확인을 다시
 * 부른다 — 확인 결과는 보관하지 않으므로 다시 부르지 않으면 가입 버튼이 켜지지 않는다.
 * 가입에 성공하면 store.clear()로 지운다.
 */

import type { SignupValues } from './signupRules.ts';
import { EMPTY_TERMS, type TermsState } from './terms.ts';

export type SignupDraft = {
  readonly email: string;
  readonly name: string;
  readonly organization: string;
  readonly terms: TermsState;
};

export interface DraftStore {
  load(): SignupDraft | undefined;
  save(draft: SignupDraft): void;
  clear(): void;
}

function copyDraft(draft: SignupDraft): SignupDraft {
  return {
    email: draft.email,
    name: draft.name,
    organization: draft.organization,
    terms: {
      age14: draft.terms.age14,
      service: draft.terms.service,
      privacy: draft.terms.privacy,
      marketing: draft.terms.marketing,
    },
  };
}

export function createMemoryDraftStore(): DraftStore {
  let kept: SignupDraft | undefined;
  return {
    load: () => (kept ? copyDraft(kept) : undefined),
    save: (draft) => {
      kept = copyDraft(draft);
    },
    clear: () => {
      kept = undefined;
    },
  };
}

/** 폼 값에서 보관할 것만 골라 담는다. 비밀번호와 비밀번호 확인은 담지 않는다. */
export function toSignupDraft(values: SignupValues, terms: TermsState): SignupDraft {
  return copyDraft({ email: values.email, name: values.name, organization: values.organization, terms });
}

export function saveSignupDraft(store: DraftStore, values: SignupValues, terms: TermsState): void {
  store.save(toSignupDraft(values, terms));
}

/** 보관한 값으로 폼을 되살린다. 비밀번호 두 칸은 항상 빈 값이다. 보관한 것이 없으면 빈 폼. */
export function restoreSignupForm(store: DraftStore): { values: SignupValues; terms: TermsState } {
  const draft = store.load();
  return {
    values: {
      email: draft?.email ?? '',
      password: '',
      passwordConfirm: '',
      name: draft?.name ?? '',
      organization: draft?.organization ?? '',
    },
    terms: draft ? draft.terms : EMPTY_TERMS,
  };
}
