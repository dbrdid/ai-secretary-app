import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isWellFormedEvidence, resolveEvidence, type EvidenceLocation, type SourceSnapshot } from './evidence.ts';

const memo: SourceSnapshot = { id: 'src-1', version: 2, inTrash: false, content: { kind: 'text', text: '금요일 3시 기획 회의' } };
const at = (start: number, end: number, sourceVersion = 2): EvidenceLocation => ({ kind: 'text', sourceId: 'src-1', sourceVersion, start, end });

describe('DTL-UX-005 [근거 보기] 이동 위치', () => {
  test('텍스트 범위를 그대로 돌려주고 칠할 글자를 함께 준다', () => {
    assert.deepEqual(resolveEvidence(at(0, 7), memo), { status: 'ok', kind: 'text', start: 0, end: 7, excerpt: '금요일 3시 ' });
  });

  test('원본이 고쳐졌으면(버전 다름) 위치를 짐작하지 않고 sourceChanged', () => {
    assert.deepEqual(resolveEvidence(at(0, 3, 1), memo), { status: 'sourceChanged' });
  });

  test('원본이 휴지통이면 sourceInTrash(버전보다 먼저 알린다), 영구 삭제면 sourceMissing', () => {
    assert.deepEqual(resolveEvidence(at(0, 3, 1), { ...memo, inTrash: true }), { status: 'sourceInTrash' });
    assert.deepEqual(resolveEvidence(at(0, 3), undefined), { status: 'sourceMissing' });
    assert.deepEqual(resolveEvidence(at(0, 3), { ...memo, id: 'src-2' }), { status: 'sourceMissing' });
  });

  test('범위가 원본 밖이거나 비어 있으면 invalidLocation — 가까운 문장으로 대신 옮기지 않는다', () => {
    assert.deepEqual(resolveEvidence(at(5, 99), memo), { status: 'invalidLocation' });
    assert.deepEqual(resolveEvidence(at(3, 3), memo), { status: 'invalidLocation' });
    assert.deepEqual(resolveEvidence(at(-1, 3), memo), { status: 'invalidLocation' });
  });

  test('이모지 가운데를 자르는 범위는 받지 않는다(UTF-16 단위)', () => {
    const text = '회의는 😀 금요일'; // 😀가 4~5번 두 칸
    const src: SourceSnapshot = { ...memo, content: { kind: 'text', text } };
    assert.equal(resolveEvidence(at(4, 6), src).status, 'ok');
    assert.deepEqual(resolveEvidence(at(5, 6), src), { status: 'invalidLocation' });
    assert.deepEqual(resolveEvidence(at(0, 5), src), { status: 'invalidLocation' });
  });

  test('음성은 길이 안의 밀리초 구간, 문서는 1부터 쪽수까지', () => {
    const audio: SourceSnapshot = { id: 'rec-1', version: 1, inTrash: false, content: { kind: 'audio', durationMs: 60_000 } };
    const loc = (startMs: number, endMs: number): EvidenceLocation => ({ kind: 'audio', sourceId: 'rec-1', sourceVersion: 1, startMs, endMs });
    assert.deepEqual(resolveEvidence(loc(12_000, 15_500), audio), { status: 'ok', kind: 'audio', startMs: 12_000, endMs: 15_500 });
    assert.deepEqual(resolveEvidence(loc(59_000, 60_001), audio), { status: 'invalidLocation' });

    const pdf: SourceSnapshot = { id: 'doc-1', version: 1, inTrash: false, content: { kind: 'document', pageCount: 12 } };
    const page = (n: number): EvidenceLocation => ({ kind: 'page', sourceId: 'doc-1', sourceVersion: 1, page: n });
    assert.deepEqual(resolveEvidence(page(12), pdf), { status: 'ok', kind: 'page', page: 12 });
    assert.deepEqual(resolveEvidence(page(13), pdf), { status: 'invalidLocation' });
    assert.deepEqual(resolveEvidence(page(0), pdf), { status: 'invalidLocation' });
  });

  test('위치 종류와 원본 종류가 다르면 invalidLocation', () => {
    const audio: SourceSnapshot = { id: 'src-1', version: 2, inTrash: false, content: { kind: 'audio', durationMs: 60_000 } };
    assert.deepEqual(resolveEvidence(at(0, 3), audio), { status: 'invalidLocation' });
  });

  test('모양 검사: 원본 ID가 비었거나 소수·음수면 저장 전에 거른다', () => {
    assert.equal(isWellFormedEvidence(at(0, 3)), true);
    assert.equal(isWellFormedEvidence({ ...at(0, 3), sourceId: '' }), false);
    assert.equal(isWellFormedEvidence(at(0.5, 3)), false);
    assert.equal(isWellFormedEvidence({ kind: 'page', sourceId: 'doc-1', sourceVersion: 1, page: 0 }), false);
  });
});
