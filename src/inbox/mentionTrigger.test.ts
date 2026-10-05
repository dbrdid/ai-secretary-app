import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCandidate, findActiveTrigger, rankCandidates } from './mentionTrigger.ts';

/** 팝업이 떠야 하는 자리에서 트리거를 꺼낸다. */
function triggerAt(text: string, caret: number) {
  const trigger = findActiveTrigger(text, caret);
  if (trigger === null) throw new Error(`팝업이 떠야 한다: ${JSON.stringify(text)} @${caret}`);
  return trigger;
}

describe('findActiveTrigger — #·@ 입력 감지(DTL-INB-002)', () => {
  test("본문 처음의 '#'은 태그 팝업, 검색어는 기호 뒤부터 커서까지", () => {
    assert.deepEqual(findActiveTrigger('#회', 2), { kind: 'tag', query: '회', start: 0, end: 2 });
  });

  test("공백 뒤의 '@'는 프로젝트·담당자 멘션 팝업", () => {
    assert.deepEqual(findActiveTrigger('오늘 @김', 5), { kind: 'mention', query: '김', start: 3, end: 5 });
  });

  test('기호만 쳤으면 검색어는 빈 문자열(전체 목록)', () => {
    assert.deepEqual(findActiveTrigger('메모 #', 4), { kind: 'tag', query: '', start: 3, end: 4 });
  });

  test('줄바꿈 뒤에서도 뜬다', () => {
    assert.deepEqual(findActiveTrigger('첫 줄\n#회의', 7), { kind: 'tag', query: '회의', start: 4, end: 7 });
  });

  test("[해석] 낱말 가운데의 기호는 무시한다: 메일 주소의 '@', 'C#'", () => {
    assert.equal(findActiveTrigger('kim@example.com', 15), null);
    assert.equal(findActiveTrigger('C#', 2), null);
  });

  test('검색어 뒤에 공백을 치면 팝업이 닫힌다', () => {
    assert.equal(findActiveTrigger('#태그 ', 4), null);
  });

  test('낱말 가운데에 커서가 있으면 검색어는 커서까지, 바꿀 범위는 낱말 끝까지', () => {
    assert.deepEqual(findActiveTrigger('#회의록 내용', 2), { kind: 'tag', query: '회', start: 0, end: 4 });
  });

  test('커서 위치가 본문 밖이면 본문 안으로 맞춘다', () => {
    assert.deepEqual(findActiveTrigger('#a', 99), { kind: 'tag', query: 'a', start: 0, end: 2 });
    assert.equal(findActiveTrigger('#a', -1), null);
  });
});

describe('rankCandidates — 후보 거르기', () => {
  const same = (s: string) => s;

  test('앞에서부터 맞는 것 먼저, 그다음 중간에 들어 있는 것', () => {
    assert.deepEqual(rankCandidates(['회의록', '주간 회의', '회계', '기획'], '회', same), ['회의록', '회계', '주간 회의']);
  });

  test('대소문자를 가리지 않는다', () => {
    assert.deepEqual(rankCandidates(['Alpha', 'beta', 'ALPHABET'], 'al', same), ['Alpha', 'ALPHABET']);
  });

  test('맥에서 온 풀어쓴 한글(NFD) 이름도 찾는다', () => {
    const nfd = '회의록'.normalize('NFD');
    assert.deepEqual(rankCandidates([nfd], '회의', same), [nfd]);
  });

  test('검색어가 비면 앞에서부터 limit개(기본 20개)', () => {
    const many = Array.from({ length: 25 }, (_, i) => `태그${i}`);
    assert.equal(rankCandidates(many, '', same).length, 20);
    assert.deepEqual(rankCandidates(many, '', same, 2), ['태그0', '태그1']);
  });

  test('객체 후보는 labelOf로 이름을 꺼낸다', () => {
    const people = [
      { id: 'u1', name: '김민수' },
      { id: 'u2', name: '민지' },
      { id: 'u3', name: '박지민' },
    ];
    assert.deepEqual(
      rankCandidates(people, '민', (p) => p.name).map((p) => p.id),
      ['u2', 'u1', 'u3'],
    );
  });
});

describe('applyCandidate — 고른 후보를 본문에 넣기', () => {
  test('본문 끝이면 뒤에 공백을 붙이고 커서를 그 뒤로', () => {
    const text = '오늘 @김';
    assert.deepEqual(applyCandidate(text, triggerAt(text, 5), '김민수'), { text: '오늘 @김민수 ', caret: 8 });
  });

  test("낱말 가운데를 고쳐 골라도 뒷부분이 남지 않는다('#회의록록' 방지). 이미 있는 공백은 두 번 넣지 않는다", () => {
    const text = '#회의록 내용';
    assert.deepEqual(applyCandidate(text, triggerAt(text, 2), '회의록'), { text: '#회의록 내용', caret: 5 });
  });

  test('태그는 #를 앞에 붙여 넣는다', () => {
    const text = '메모 #';
    assert.deepEqual(applyCandidate(text, triggerAt(text, 4), '기획'), { text: '메모 #기획 ', caret: 7 });
  });
});
