import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_UPLOAD_LIMITS, FILE_INPUT_ACCEPT, MB, checkPickedFiles, fileKindOf, type PickCheck, type PickedFile } from './filePick.ts';

/** 파일마다 종류 또는 거절 이유 */
const outcomes = <F extends PickedFile>(check: PickCheck<F>) => check.verdicts.map((v) => (v.ok ? v.kind : v.reason));

describe('fileKindOf — 확장자로 종류 판정(DTL-INB-007)', () => {
  test('JPG·JPEG·PNG는 사진, PDF·PPTX는 문서. 대소문자는 가리지 않는다', () => {
    assert.equal(fileKindOf('IMG_0001.JPG'), 'image');
    assert.equal(fileKindOf('photo.jpeg'), 'image');
    assert.equal(fileKindOf('capture.png'), 'image');
    assert.equal(fileKindOf('회의자료.PDF'), 'document');
    assert.equal(fileKindOf('발표.pptx'), 'document');
  });

  test('마지막 점 뒤를 본다', () => {
    assert.equal(fileKindOf('report.final.pdf'), 'document');
    assert.equal(fileKindOf('image.png.exe'), null);
  });

  test('[합의 필요 OD-21] 원문에 없는 형식(HEIC·PPT·HWP)과 확장자 없는 파일은 받지 않는다', () => {
    for (const name of ['IMG_0002.HEIC', 'old.ppt', '보고서.hwp', 'README', 'dot.']) {
      assert.equal(fileKindOf(name), null, name);
    }
  });
});

describe('checkPickedFiles — 여러 파일 선택 검사', () => {
  test('고른 순서대로 파일마다 판정하고, 올릴 수 있는 파일의 크기만 더한다', () => {
    const files = [
      { name: 'a.jpg', size: 2 * MB },
      { name: 'b.hwp', size: 1 * MB },
      { name: 'c.pdf', size: 0 },
      { name: 'd.pptx', size: 50 * MB + 1 },
      { name: 'e.png', size: 3 * MB },
    ];
    const result = checkPickedFiles(files);
    assert.deepEqual(outcomes(result), ['image', 'unsupportedType', 'empty', 'tooLarge', 'image']);
    assert.ok(result.verdicts.every((v, i) => v.file === files[i]), '받은 파일 객체를 그대로 돌려준다');
    assert.equal(result.okBytes, 5 * MB);
    assert.equal(result.totalTooLarge, false);
  });

  test('상한은 경계값까지 허용한다(단일 50MB, 합산 100MB — DTL-INB-008 값)', () => {
    assert.deepEqual(DEFAULT_UPLOAD_LIMITS, { maxFileBytes: 50 * MB, maxTotalBytes: 100 * MB });

    const exact = checkPickedFiles([
      { name: 'a.pdf', size: 50 * MB },
      { name: 'b.pdf', size: 50 * MB },
    ]);
    assert.deepEqual(outcomes(exact), ['document', 'document']);
    assert.equal(exact.totalTooLarge, false);

    const over = checkPickedFiles([
      { name: 'a.pdf', size: 50 * MB },
      { name: 'b.pdf', size: 50 * MB },
      { name: 'c.png', size: 1 },
    ]);
    assert.equal(over.okBytes, 100 * MB + 1);
    assert.equal(over.totalTooLarge, true);
  });

  test('형식이 틀리면 크기보다 먼저 알린다', () => {
    assert.deepEqual(outcomes(checkPickedFiles([{ name: 'x.hwp', size: 0 }])), ['unsupportedType']);
  });

  test('상한은 인자로 바꿀 수 있다', () => {
    const result = checkPickedFiles([{ name: 'a.png', size: 2 * MB }], { maxFileBytes: 1 * MB, maxTotalBytes: 10 * MB });
    assert.deepEqual(outcomes(result), ['tooLarge']);
    assert.equal(result.okBytes, 0);
  });

  test('아무것도 고르지 않으면 빈 결과', () => {
    assert.deepEqual(checkPickedFiles([]), { verdicts: [], okBytes: 0, totalTooLarge: false });
  });
});

describe('FILE_INPUT_ACCEPT — 선택 창에 넘길 값', () => {
  test('확장자와 MIME을 함께 적는다(MIME만 보고 거르는 모바일 브라우저 대비)', () => {
    const parts = FILE_INPUT_ACCEPT.split(',');
    const expected = [
      '.jpg',
      '.jpeg',
      '.png',
      '.pdf',
      '.pptx',
      'image/jpeg',
      'image/png',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    for (const part of expected) assert.ok(parts.includes(part), part);
  });
});
