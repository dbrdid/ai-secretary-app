/**
 * 사진·문서 파일 선택 검사 — DTL-INB-007(상위 REQ-INB-007).
 * 원문: 파일 선택 창을 호출하여 JPG, PNG, PDF, PPTX 파일을 다중 선택하여 업로드할 수 있다. 모바일 브라우저에서는
 * 카메라 촬영과 갤러리 선택을 함께 제공한다.
 * 선택 창·카메라는 화면 몫이다. 여기서는 선택 창에 넘길 accept 값과, 고른 파일마다 올릴 수 있는지를 판정한다.
 * 실제 업로드와 내용 검사(정말 그 형식인지)는 서버 몫이다 — 확장자는 이름만 바꿔도 속일 수 있다.
 * 화면 참고(일반 지식, 실기기 확인 필요): 파일 입력에 capture 속성을 붙이면 모바일에서 카메라만 열려 갤러리를 고를 수
 * 없다. 원문이 둘 다 요구하므로 붙이지 않는다.
 *
 * 결정과 이유
 * - 확장자로 판정하고 브라우저가 알려 주는 MIME(type)은 보지 않는다. 운영체제에 따라 PPTX의 type이 빈 값이거나 JPG가
 *   'image/pjpeg'로 오는 일이 있어, MIME까지 맞추라고 하면 멀쩡한 파일을 막는다.
 * - JPG에는 .jpeg도 넣는다(같은 형식의 다른 확장자). 대소문자는 가리지 않는다(IMG_0001.JPG).
 * - 파일마다 판정만 한다. 틀린 파일이 섞였을 때 나머지를 올릴지 전부 막을지는 부르는 쪽이 정한다(OD-21).
 * - 크기 상한은 DTL-INB-008(예외 분류: 단일 50MB, 합산 100MB) 값을 기본으로 두고 인자로 바꿀 수 있게 했다. 넘었을 때의
 *   처리(에러 모달)는 예외 담당 몫이라 여기서는 넘었는지만 알린다. [임시 가정] 1MB = 1024×1024바이트(OD-21).
 * - [해석] 0바이트 파일은 받지 않는다. 분석할 내용이 없다.
 * - [합의 필요] 한 번에 고를 수 있는 개수, 아이폰 사진(HEIC)·옛 PPT·HWP 같은 다른 형식은 원문에 없다(OD-21).
 */

/** 브라우저 File 객체를 그대로 넘길 수 있다(name·size만 본다). */
export type PickedFile = { readonly name: string; readonly size: number };

export type FileKind = 'image' | 'document';

export const ALLOWED_EXTENSIONS: Readonly<Record<string, FileKind>> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  pdf: 'document',
  pptx: 'document',
};

/** <input type="file" multiple accept={FILE_INPUT_ACCEPT}>. 확장자와 MIME을 함께 적어야 걸러 주는 모바일 브라우저가 있다. */
export const FILE_INPUT_ACCEPT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.pptx',
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',');

export const MB = 1024 * 1024;

export type UploadLimits = { readonly maxFileBytes: number; readonly maxTotalBytes: number };

/** DTL-INB-008 원문 값(예외 담당 항목). */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = { maxFileBytes: 50 * MB, maxTotalBytes: 100 * MB };

export type FileVerdict<F extends PickedFile> =
  | { readonly file: F; readonly ok: true; readonly kind: FileKind }
  | { readonly file: F; readonly ok: false; readonly reason: 'unsupportedType' | 'empty' | 'tooLarge' };

export type PickCheck<F extends PickedFile> = {
  /** 고른 순서 그대로 */
  readonly verdicts: readonly FileVerdict<F>[];
  /** 올릴 수 있는(ok) 파일의 크기 합 */
  readonly okBytes: number;
  /** okBytes가 합산 상한을 넘었는지 */
  readonly totalTooLarge: boolean;
};

/** 파일 이름의 확장자로 종류를 정한다. 지원하지 않으면 null. */
export function fileKindOf(name: string): FileKind | null {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return null;
  return ALLOWED_EXTENSIONS[name.slice(dot + 1).toLowerCase()] ?? null;
}

export function checkPickedFiles<F extends PickedFile>(files: readonly F[], limits: UploadLimits = DEFAULT_UPLOAD_LIMITS): PickCheck<F> {
  const verdicts = files.map((file): FileVerdict<F> => {
    const kind = fileKindOf(file.name);
    if (kind === null) return { file, ok: false, reason: 'unsupportedType' };
    if (file.size <= 0) return { file, ok: false, reason: 'empty' };
    if (file.size > limits.maxFileBytes) return { file, ok: false, reason: 'tooLarge' };
    return { file, ok: true, kind };
  });
  const okBytes = verdicts.reduce((sum, v) => (v.ok ? sum + v.file.size : sum), 0);
  return { verdicts, okBytes, totalTooLarge: okBytes > limits.maxTotalBytes };
}
