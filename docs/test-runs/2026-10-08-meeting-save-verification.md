# 회의록 수정·저장 검증 (2026-10-08)

## 범위 및 결과
프로젝트: /Users/shiomiikuhiro/Projects/ai-secretary-app
MyClaw bash 실제 실행 성공. 이번 호출에 Bash 이름 전달 오류나 승인 거절 없음.
AGENTS.md·HANDOFF.md 먼저 읽음. 과거 테스트 기록을 현재 증거로 사용하지 않음.

- `npm run test:web`: 종료 0, 8/8. 메모리 어댑터 저장·복원·검토 필수·반복 저장·손상 데이터·저장 예외·입력 검증과 HTTP 자산/접근 제한.
- `node scripts/verify-browser.mjs`: 종료 0, Chrome 8/8. 임시 서버/임시 프로필에서 요약 수정·검토 해제·재검토·localStorage 저장·문서 교체 후 복원·반복 저장·주입한 저장 실패·손상 데이터 잠금. 근거 초점/Space 체크 포함.
- 아래 추가 명령: 종료 0, 4173 자산 4개 현재 파일 일치 및 Chrome 9/9. 회의록 제목/요약/논의/결정/미확정 5개, 두 업무 제목/담당자/기한 6개를 입력 이벤트로 수정하고 저장된 JSON 및 실제 새로고침 후 모든 입력값 일치 확인. confirmed·savedAt 확인. 담당자/기한 공란 유지.

## 저장 방식·보호
서버 저장이 아니라 origin별 브라우저 localStorage의 ai-secretary:desktop-demo:v1 키 한 개를 갱신. 서버는 정적 자산 GET/HEAD만 제공. 계정·기기 동기화 아님.
원본 스크립트의 mkdtemp와 --user-data-dir로 기존 사용자 Chrome 프로필과 격리됨을 실행 전 확인. 추가 검증도 같은 격리 방식을 유지하면서 대상 URL만 127.0.0.1:4173으로 변경. 원본 파일은 변경하지 않고 메모리에서 검증 코드를 보강함. 기존 사용자 localStorage 접근/삭제/덮어쓰기 없음.
프로필: 최초 /var/folders/bh/h8khrbb91vv03tz2t2zny7wr0000gn/T/ai-secretary-browser-e2AcKR, 추가 /var/folders/bh/h8khrbb91vv03tz2t2zny7wr0000gn/T/ai-secretary-browser-zoNMCZ. 프로필은 임시 폴더에 남음. 스크립트 finally에서 자체 Chrome 종료 신호 및 임시 서버 종료, 기존 4173 서버는 유지.
외부 전송·설치·AI 실행 명령 없음. 브라우저 배경 네트워킹/동기화 비활성 플래그 사용. 패킷 캡처 검증은 아님.

## 결함과 미검증
검증 범위에서 앱 수정/저장/복원 결함 재현 없음. DOM 값 대입+input 이벤트 및 버튼 클릭 검증이며 실제 모든 글자 키 입력/IME/시각 품질/전체 접근성 검증 아님. 실제 디스크 용량 소진이 아니라 예외 주입. 다중 탭 충돌·브라우저 완전 종료 후 복원·다른 브라우저/기기·장기 보존 미검증. 저장 데이터 삭제 시 손실 가능. 실제 STT/AI는 범위 밖.

## 변경 파일
이 보고서와 HANDOFF.md 상단 기록만 변경. web/·package.json·scripts/ 원본 무수정. 기존 작업 트리 변경은 유지.

## 정확한 실행 명령
작업 디렉터리는 위 프로젝트. 첫 두 명령은 종료 코드를 출력하는 다음 wrapper로 실행:

```sh
npm run test:web; result=$?; printf '\\nTEST_WEB_EXIT=%s\\n' "$result"; exit "$result"
node scripts/verify-browser.mjs; result=$?; printf '\\nBROWSER_EXIT=%s\\n' "$result"; exit "$result"
```

추가 4173 검증 명령(원본 스크립트 무수정):

```sh
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:4173';
for (const [url, file] of [['/','index.html'],['/app.mjs','app.mjs'],['/model.mjs','model.mjs'],['/style.css','style.css']]) {
  const response = await fetch(base + url);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), await readFile('web/' + file, 'utf8'));
}
console.log('PASS 4173 HTTP 200 및 웹 자산 4개 현재 파일 일치');
let source = await readFile('scripts/verify-browser.mjs', 'utf8');
source = source.replace("from './serve-web.mjs'", "from " + JSON.stringify(new URL('./scripts/serve-web.mjs', 'file://' + process.cwd() + '/').href));
source = source.replace("const base = 'http://127.0.0.1:' + server.address().port;", "const base = 'http://127.0.0.1:4173';");
const marker = "  pass('반복 저장 시 저장 키 중복 없음');";
assert.ok(source.includes(marker));
source = source.replace(marker, marker + `
  const edited = {
    title: '격리 검증 제목', summary: '브라우저 검증 수정본',
    discussion: '수정 논의\\n둘째 줄', decisions: '수정 결정', unresolved: '수정 미확정',
    'task-0-title': '수정 업무 하나', 'task-0-assignee': '검증 담당자', 'task-0-due': '2026-10-12',
    'task-1-title': '수정 업무 둘', 'task-1-assignee': '', 'task-1-due': ''
  };
  await evaluate('(' + ((values) => {
    for (const [id, value] of Object.entries(values)) {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
  }).toString() + ')(' + JSON.stringify(edited) + ')');
  assert.equal(await evaluate("document.querySelector('#reviewed').checked"), false);
  assert.equal(await evaluate("document.querySelector('#save').disabled"), true);
  await evaluate("document.querySelector('#reviewed').click(); document.querySelector('#save').click()");
  assert.match(await evaluate("document.querySelector('#message').textContent"), /확정본을 이 브라우저에 저장/);
  const saved = await evaluate("JSON.parse(localStorage.getItem('ai-secretary:desktop-demo:v1'))");
  for (const field of ['title','summary','discussion','decisions','unresolved']) assert.equal(saved[field], edited[field]);
  saved.tasks.forEach((task, i) => {
    for (const field of ['title','assignee','due']) assert.equal(task[field], edited['task-' + i + '-' + field]);
  });
  assert.equal(saved.status, 'confirmed');
  assert.ok(Number.isFinite(Date.parse(saved.savedAt)));
  await evaluate('window.__verificationOldDocument = true');
  await call('Page.reload');
  await ready();
  for (const [id, value] of Object.entries(edited)) assert.equal(await evaluate('document.getElementById(' + JSON.stringify(id) + ').value'), value);
  assert.match(await evaluate("document.querySelector('#message').textContent"), /복원/);
  pass('4173 회의록 5항목·업무 6항목 저장값 및 새 문서 복원 일치');
`);
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
NODE
```

### 추가 검증 원시 결과
```json
{
  "content": [
    {
      "type": "text",
      "text": "종료 코드 0\n\nPASS 4173 HTTP 200 및 웹 자산 4개 현재 파일 일치\nPASS 실제 Chrome에서 초기 렌더링·예시 표시·검토 전 저장 잠금\nPASS 근거 클릭 후 원문 강조·초점 이동\nPASS 키보드 Space 검토 체크\nPASS 편집 후 검토 해제·저장 잠금\nPASS 실제 localStorage 저장·새로고침 복원·미지정 담당자/기한 유지\nPASS 반복 저장 시 저장 키 중복 없음\nPASS 4173 회의록 5항목·업무 6항목 저장값 및 새 문서 복원 일치\nPASS 주입한 저장 예외: 오류 안내·입력 유지·이전 저장본 보존\nPASS 손상 저장본 읽기 실패·덮어쓰기 잠금\n{\n  \"passed\": 9,\n  \"checks\": [\n    \"실제 Chrome에서 초기 렌더링·예시 표시·검토 전 저장 잠금\",\n    \"근거 클릭 후 원문 강조·초점 이동\",\n    \"키보드 Space 검토 체크\",\n    \"편집 후 검토 해제·저장 잠금\",\n    \"실제 localStorage 저장·새로고침 복원·미지정 담당자/기한 유지\",\n    \"반복 저장 시 저장 키 중복 없음\",\n    \"4173 회의록 5항목·업무 6항목 저장값 및 새 문서 복원 일치\",\n    \"주입한 저장 예외: 오류 안내·입력 유지·이전 저장본 보존\",\n    \"손상 저장본 읽기 실패·덮어쓰기 잠금\"\n  ],\n  \"profile\": \"/var/folders/bh/h8khrbb91vv03tz2t2zny7wr0000gn/T/ai-secretary-browser-zoNMCZ\",\n  \"scope\": \"Headless Chrome DOM·키보드 일부 검증. 시각 품질·전체 Tab 순서·실제 용량 소진·다중 탭은 별도 검증.\"\n}\n"
    }
  ]
}
```
