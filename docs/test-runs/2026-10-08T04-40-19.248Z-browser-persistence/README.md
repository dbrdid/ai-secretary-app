# 다중 탭 충돌·Chrome 정상 종료 후 복원 실제 검사
- 실행일: 2026-10-08 / Asia/Seoul. 실제 실행 13:40:19~13:40:22.
- 프로젝트: /Users/shiomiikuhiro/Projects/ai-secretary-app
- 원시 증거: result.json (각 시나리오 UI·localStorage 전체 비교, Chrome 실행 인자·PID·종료 기록).
- 신규 실행기: scripts/verify-browser-persistence.mjs
- 이번 MyClaw bash 실제 호출 성공. 사용자 전달의 과거 Bash 변환 unknown tool 오류 2회는 이번에 재현되지 않음. 승인 거절 없음.
- AGENTS.md/HANDOFF.md와 기존 실행기·서버·앱·모델을 read_file로 먼저 읽음. pwd 종료 0으로 프로젝트 확인. scripts/docs 하위 AGENTS.md 조회 결과 없음.
- 작성 전 이해 확인 ask_user는 "이 대화(자식·예약)에는 답할 사람이 없습니다" 오류. 상세 사용자 실행 지시에 따라 검증 도구만 작성. 제품 코드 무수정.

## 결과
전체 11개 검사 중 9 통과, 2 실패. complete=true, 스크립트 종료 1.
자동 동기화 없음 1개 결함을 양방향에서 재현했으며 정상으로 완화하지 않았다.

1. A의 실제 UI에서 회의록 5개·업무 6개 필드 수정·검토·저장 후 같은 프로필/동일 origin의 신규 B 탭 복원 일치.
2. 두 탭이 열린 상태에서 B에 미저장 편집을 남기고 A 저장:
   - B에 다른 탭 변경 경고, 저장 잠금 확인.
   - B 재검토 및 저장 버튼 클릭 시도 후 A 저장 JSON 보존. B 미저장 입력도 UI에 유지.
   - B 화면의 A 변경 자동 반영은 실패. B 새로고침 후에는 저장된 A 변경 반영.
3. B 저장→오래된 A 편집/저장 시도에서도 같은 결과. 양방향 덮어쓰기 보호는 통과, 자동 동기화는 실패.
4. Browser.close 후 테스트 Chrome 프로세스 exit 및 PID 부재를 확인한 뒤 같은 프로필·origin으로 재실행. 전체 저장 JSON, 11개 UI 필드, 상태 문구, 저장 시각 표시, 검토 체크·저장 잠금 일치.
5. 두 번째 실행에서 제목·업무 미저장 편집 및 검토 체크 후 Browser.close. 세 번째 실행에서 미저장 편집·체크는 사라지고 이전 확정 저장본 유지.
6. 검토 상태 의미: 저장 status=confirmed와 "사용자 확정 · 예시" 유지. 검토 체크는 저장 직후부터 false이고 저장 버튼 disabled=true이며 재시작 후도 동일. 체크 자체가 저장되는 것으로 해석하지 않음.
7. 마지막 테스트 Chrome까지 정상 종료. 정상 종료 검증은 탭 새로고침과 구분됨.

## 격리·프로세스 증거
- profile: /var/folders/bh/h8khrbb91vv03tz2t2zny7wr0000gn/T/ai-secretary-persistence-UtiaAa
- origin: http://127.0.0.1:56543 (createWebServer 임시 서버를 세 번의 Chrome 실행 내내 유지)
- Chrome PID: 99135 → 99351 → 99364
- 각각 Browser.close 응답 acknowledged, child exitCode=0, signal=null, process.kill(pid, 0) 조회 ESRCH(pidAbsent=true).
- 실행 후 ps 전체 명령행에서 위 독립 프로필 이름으로 제한 조회했으며 일치 행 없음(grep 종료 1: 조회 실패가 아니라 일치 없음).
- 기존 Chrome에는 CDP 연결·종료·저장 접근을 하지 않음. 임시 프로필만 생성하고 남겨 둠.
- 로컬 4173 서버는 GET 조회만 수행. /, /app.mjs, /model.mjs, /style.css 모두 HTTP 200이고 현재 web 자산과 바이트·SHA-256 일치. 서버 변경/재시작 없음.
- 앱 제품 코드·기존 검증기·package.json 무수정. 설치·외부 전송·커밋·배포 없음.

## 명령과 실제 종료 코드
첫 조회: pwd → 0.
범위 확인: find scripts docs -name AGENTS.md -print; git status --short → 0.
구문 검사: node --check scripts/verify-browser-persistence.mjs → 0.

실제 실행한 셸 명령:
```sh
npm run test:web; web_code=$?; printf '\nTEST_WEB_EXIT=%s\n' "$web_code"; node scripts/verify-browser-persistence.mjs; browser_code=$?; printf '\nBROWSER_PERSISTENCE_EXIT=%s\n' "$browser_code"; git diff --check; diff_code=$?; printf '\nDIFF_CHECK_EXIT=%s\n' "$diff_code"
```
- npm run test:web → 0, 8/8 통과.
- node scripts/verify-browser-persistence.mjs → 1, 9/11 통과·자동 동기화 양방향 2 실패.
- git diff --check → 0.
- 위 래퍼 셸 → 0(마지막 printf 결과). 이를 브라우저 테스트 성공으로 오인하지 않음.
- shasum -a 256 scripts/verify-browser-persistence.mjs docs/test-runs/2026-10-08T04-40-19.248Z-browser-persistence/result.json → 해시 출력 완료.
- ps -axo pid=,command= | grep '[a]i-secretary-persistence-UtiaAa' → 1, 일치 행 없음.

## SHA-256
- scripts/verify-browser-persistence.mjs:
  ea0afa40e889a865e0a1b84315e9dcf1498c0517fd31338ab95c5337037de5a4
- result.json:
  045c37ffe04bfb83ba3e7b6ff5b98b89fd90c003e240630f01728ec8ebde3fa6

## 결함·미검증·다음 행동
- 결함: 저장 변경이 다른 탭 UI에 자동 동기화되지 않음. 현재 경고·저장 잠금·사용자 새로고침 방식이며, 자동 반영 기대는 실패로 유지.
- 팀 결정: 자동 동기화 시 미저장 입력과 충돌하는 정책을 결정해야 함. 이번에는 제품 코드를 고치지 않음.
- 다중 탭 검사는 동시에 열린 두 탭의 겹친 편집과 순차 저장 충돌이다. 두 탭 setItem이 정확히 동시 실행되는 좁은 경쟁 구간, storage 이벤트 도착 전 초고속 저장 경쟁은 미검증.
- beforeunload 경고가 실제 사용자 상호작용 조건에서 표시되는지 별도 검증 아님. 이번 Browser.close에서는 대화상자 이벤트 기록 없음.
- 강제 종료·충돌 복구·OS 재시작·실제 사용자 프로필·GUI 시각/접근성·장기 반복 내구성 범위 밖.
- HTTP 3초, WebSocket 연결/CDP 5초, 시작 15초, exit 10초, 전체 90초 제한. timeout을 성공으로 간주하지 않고 사용자 Chrome 강제 종료 없음.
- 다음 행동: 팀에서 자동 반영/충돌 UX 정책을 결정하고, 구현 요청 시 별도 변경·경쟁 구간 검사.
