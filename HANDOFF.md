# HANDOFF — 개인형 AI 비서 앱

## GitHub 브랜치 공유 상태 (2026-10-09)
### PR 상태
- PR #2: https://github.com/dbrdid/ai-secretary-app/pull/2 (base main ← feature/web-demo-2026-10-08). 사용자가 생성했다고 알려 줌.
- 확인 상태: 사용자 보고 기준. WebFetch로 가져오기 시 404 응답. 비공개 저장소 인증 문제일 수 있어 PR 부재로 단정하지 않음. 댓글·상태는 미확인.
- 다음 행동: PR 댓글을 받으면 같은 브랜치에 반영한다. 댓글 내용은 사용자가 붙여 넣는 것을 기준으로 한다.
### 목표
조원 피드백을 받을 수 있도록 웹 시연본을 GitHub에 올리고 기본 점검 절차를 공유한다.
### 한 것 (경로)
- 브랜치 feature/web-demo-2026-10-08을 origin에 push. 최근 커밋: 09a2241 조원 점검 가이드(docs/team-check-guide.md), 4e9e062 origin/main 병합(충돌 없음), d163c91 웹 시연본·검증 기록.
- main에는 직접 올리지 않음. 팀원 커밋 cf52a71, 5107582가 main에 먼저 있었다.
### 확인한 것과 방법
- 병합 후 npm run check: 타입 검사·테스트 309개 통과(이전 보고 기준). npm run test:web: 8개 통과.
- 로컬 HEAD와 origin/feature/web-demo-2026-10-08가 09a2241로 일치, 작업 트리 변경 없음(.serena/ 제외 미추적 디렉터리 존재, 이번 작업과 무관).
- PR 생성 화면 캡처(attachments/2026-10-09-215326-ced6.png)를 Codex CLI로 읽은 결과: PR은 아직 생성되지 않음. 이 내용은 Codex 읽기 결과이며 픽셀 직접 확인이 아님.
- gh CLI 없음. PR 댓글·상태는 조회하지 못함.
### 남은 것
- PR 생성(사용자가 GitHub 화면에서 Create pull request 클릭). 변경 파일 180개는 main 전체와의 차이라 리뷰 범위가 넓어 보임.
- 조원 점검 결과 미수신. 팀 결정 7건(docs/open-decisions.md 상단) 미정.
- 로그인·AI·녹음·동시 저장·모바일 실기기·Chrome 외 브라우저 미검증.
### 다음 행동
PR 생성 후 PR 링크를 받으면 조원 댓글을 확인해 같은 브랜치에 반영한다. 댓글을 가져올 수 없으면 사용자가 붙여 넣은 내용을 반영한다.

## 검토 진행·후속 업무 요약 완료 (2026-10-08)
### 목표
기존 웹 워크스페이스에서 현재 입력 기준 검토 상태·후속 업무 확인 필요 요약 및 편집 바로가기.
### 한 것 (경로)
- web/index.html, web/app.mjs, web/style.css: 전체/담당자 미입력/기한 미입력/중복 없는 확인 필요 수, 개별 업무 편집·검토 이동. 제목 공백 포함, 모두 입력해도 내용 검토 필요 표시.
- scripts/verify-browser-summary.mjs 신규. 저장/API/기존 ID/dirty/storage 계약 변경 없음. AI/STT/auth 미수정.
- docs/test-runs/2026-10-08-review-summary/README.md, 명령 로그·종료 코드·SHA256 증거.
### 확인 명령 결과
- AGENTS/HANDOFF 먼저 읽고 lowercase MyClaw bash pwd/git 상태 확인. unknown tool·승인 거절 없음.
- npm run check exit 0: 타입·227/227. npm run test:web exit 0: 8/8.
- 기존 browser 8/8, persistence 47/47, UI 13/13 모두 exit 0. 신규 summary 20/20 exit 0(최종 재실행 포함).
- 신규 검사: 입력/공백/빈 제목, 검토·저장·복원, 실제 두 탭 자동 반영/dirty 보호/최신본, 저장 실패·재시도·손상 보호, Enter 편집 이동 3개, HTML 텍스트 안전 출력.
- node --check 두 파일 및 git diff --check exit 0. model/model.test/package.json/기존 브라우저 검사 3개 SHA256 전후 동일(보고서).
- 격리 Chrome 프로필·임시 origin 사용. 320~1440px 6개 폭 DOM 경계 통과; 1440/390px 전체 PNG를 view_image로 시각 확인.
- 최종 신규 결과 docs/test-runs/2026-10-08T14-31-05.458Z-review-summary/result.json. 기존 인계 본문은 그대로 보존.
### 남은 것
동시 저장 원자성·자동 병합·모바일 실제 연동 보류 유지. 실제 모바일·타 브라우저/스크린리더·전체 접근성/IME·실제 용량 소진·강제 종료/OS 재시작 미검증. 요약의 빈 항목 검사가 실제 내용 정확성·업무 수행 완료를 뜻하지 않음.
### 다음 행동
이번 묶음 구현·회귀 완료. 보류 작업은 재요청 전 진행하지 않는다. 설치·외부 전송·커밋·배포 없음. 아래 기존 기록의 주장과 이번 실제 검사 결과를 구별한다.

## 회의 워크스페이스 화면 보완 완료 (2026-10-08)
### 목표
원문·회의록 편집·후속 업무·검토 저장 화면의 작은 완결 묶음. 전체 50개 기능 화면 완성이 아님.
### 한 것 (경로)
- web/index.html, web/style.css, web/app.mjs: 시각 계층·저장 안내·상태 우선순위·레이블·포커스·좁은 뷰포트 보완. 저장 모델/형식/기존 ID/dirty 및 탭 반영 계약 보존.
- scripts/verify-browser-ui.mjs 신규. 기존 브라우저 검사·model·package.json 작업 전후 해시 동일.
- docs/test-runs/2026-10-08-workspace-polish/README.md, 로그·종료 코드·SHA256SUMS.txt.
### 실제 확인 명령 결과
- MyClaw bash pwd와 파일 읽기로 대상 경로 및 지침 확인. 이번 unknown tool/승인 거절 없음.
- npm run check exit 0: 타입 검사·227/227. npm run test:web exit 0: 8/8.
- node scripts/verify-browser.mjs exit 0: 8/8. node scripts/verify-browser-persistence.mjs exit 0: 47/47.
- node scripts/verify-browser-ui.mjs exit 0: 13/13. 320~1440px 6개 폭 가로넘침/입력 경계, 키보드 일부, 상태 전이 실측.
- node --check 2개 및 git diff --check exit 0. 격리 Chrome 프로필·임시 origin 사용, 사용자 데이터 미접근.
- 1440/390px 전체 PNG를 view_image로 시각 확인. 4173 자산 4개 현재 파일과 HTTP 바이트/해시 일치.
- 신규 UI 검사 초기 Enter 입력 실패는 CDP Enter 문자 누락 수정 후 통과. 초기 로그 보존.
- 영속성 결과 docs/test-runs/2026-10-08T05-01-55.518Z-browser-persistence/result.json SHA-256 4ef3443f45146ee83f6b12533ea53d84007ee1322be07f246f6993ae29cd91e1.
- UI 결과 docs/test-runs/2026-10-08T05-01-59.172Z-workspace-ui/result.json SHA-256 c04999e6ea3cd0b27b6da0a261a268e4e4bbf9c1fac030b9dbaeab40051e378c.
### 남은 것
동시 저장 원자성·자동 병합 및 모바일 실제 연동은 사용자 보류. 실제 모바일/타 브라우저·스크린리더/전체 접근성·전체 Tab·IME·실제 용량 소진·강제 종료/OS 재시작 미검증. 실제 AI/STT/auth 연결 없음.
### 다음 행동
이번 묶음 구현·회귀 완료. 127.0.0.1:4173 시연 화면으로 검토 가능. 보류 작업은 사용자 재요청 전 진행하지 않는다. 설치·외부 전송·커밋·배포 없음. 이전 인계 본문은 아래 그대로 보존.


## 탭 간 자동 반영·충돌 보호 완료 (2026-10-08)
### 목표
미편집 탭 최신본 자동 반영과 미저장 입력/검토 보호, 명시 최신본 불러오기.
### 한 것 (경로)
- web/app.mjs 및 web/index.html: raw 기준 동기화·저장 직전 충돌 검사·최신본 버튼/confirm. model 및 AI/STT/auth 수정 없음.
- scripts/verify-browser-persistence.mjs: 기존 저장 보호·정상 종료/재실행 의미 유지하며 47개로 확장.
- docs/test-runs/2026-10-08-tab-sync/README.md 및 명령별 로그. 기존 인계 본문 보존.
### 확인한 것과 방법
- AGENTS/HANDOFF 먼저 읽기, MyClaw bash pwd로 프로젝트 경로 확인.
- npm run check exit 0 (타입·227/227), npm run test:web exit 0 (8/8).
- 기존 browser exit 0 (8/8), persistence exit 0 (47/47). 별도 mkdtemp Chrome 프로필·임시 origin, 사용자 저장소 수정 없음.
- 양방향 자동 반영/dirty 보호, confirm 취소·수락, 검토-only 보호, 삭제·clear·손상·읽기 오류와 복구, storage 필터·수신 무저장·늦은 payload·저장 전 raw 보호 실측.
- node --check 2개 및 git diff --check exit 0.
- 원시 결과 docs/test-runs/2026-10-08T04-49-21.546Z-browser-persistence/result.json SHA-256 fa783c25157d7f02e3ae91ea04143a90dd421499d26be9e4f1614d61a2c5e831.
### 남은 것
자동 병합 미구현. 정확한 동시 setItem 경쟁 원자성 보장 없음. 강제 종료·OS 재시작·시각/전체 접근성·IME·실제 권한/용량 소진 미검증.
### 다음 행동
요청 범위 구현·실행 검증 완료. 커밋·배포·외부 전송하지 않음. 필요 시 별도 시각 검수; 사용자 명시 요청 없는 확장 작업은 하지 않음.

## 다중 탭·Chrome 정상 종료 재실행 검증 (2026-10-08)
### 목표
동일 격리 프로필/동일 origin에서 다중 탭 저장 충돌과 Chrome 정상 종료 후 저장본 복원 실측.
### 한 것 (경로)
- scripts/verify-browser-persistence.mjs 신규: 제한 시간 있는 독립 CDP 검증. 제품 코드·기존 실행기 무수정.
- docs/test-runs/2026-10-08T04-40-19.248Z-browser-persistence/README.md 및 result.json 신규. 기존 인계 보존.
### 확인한 것과 방법
- AGENTS/HANDOFF read_file 후 MyClaw bash pwd 성공. 이번 unknown tool/승인 거절 없음.
- npm run test:web 종료 0, 8/8. 신규 스크립트 종료 1, 9/11: 자동 동기화 양방향 2 실패를 그대로 결함 기록.
- 양방향 오래된 탭 경고·저장 잠금·원본 보존 및 새로고침 반영 통과. 저장 회의록 5개/업무 6개·확정 상태 복원 비교 통과.
- Browser.close 정상 응답 후 PID 99135/99351/99364 각각 exit 0·signal null·PID 부재 확인. 같은 profile/origin 재실행 두 번, 미저장 편집 후에도 이전 저장본 유지.
- profile /var/folders/bh/h8khrbb91vv03tz2t2zny7wr0000gn/T/ai-secretary-persistence-UtiaAa, origin http://127.0.0.1:56543. 임시 프로필 보존.
- 4173 자산 4개 HTTP 200·현재 파일 바이트/해시 일치. 기존 서버·사용자 Chrome 무변경.
- node --check 및 git diff --check 종료 0. script SHA-256 ea0afa40e889a865e0a1b84315e9dcf1498c0517fd31338ab95c5337037de5a4; result SHA-256 045c37ffe04bfb83ba3e7b6ff5b98b89fd90c003e240630f01728ec8ebde3fa6.
### 남은 것
자동 동기화 없음은 결함으로 남김. 정확한 동시 setItem 경쟁 구간·강제 종료·OS 재시작·GUI는 미검증. 경고/차단 통과가 자동 동기화 통과를 의미하지 않음. 설치·외부 전송·제품 수정 없음.
### 다음 행동
팀이 미저장 입력 충돌 시 자동 반영 정책을 결정한 뒤 별도 구현/검증. 이번 검증 요청 범위 실행 완료.


## 회의록 수정·저장 실제 브라우저 검증 (2026-10-08)
### 목표
127.0.0.1:4173 웹 시연본 수정·저장·새로고침 복원 검증. 인증/AI 개발 제외.
### 한 것 (경로)
- docs/test-runs/2026-10-08-meeting-save-verification.md: 정확한 명령·종료 코드·결과·저장 방식·미검증 범위 기록.
- web/·scripts/·package.json 원본 무수정. 기존 기록 보존.
### 확인한 것과 방법
- AGENTS.md/HANDOFF.md 먼저 읽고 MyClaw bash pwd로 프로젝트 절대 경로 확인. 이번 bash 실제 성공(승인 거절/도구명 오류 없음).
- npm run test:web 종료 0, 8/8. node scripts/verify-browser.mjs 종료 0, Chrome 8/8.
- 원본을 메모리에서만 보강한 4173 대상 Chrome 종료 0, 9/9. HTTP 자산 4개 현재 web 파일 일치. 회의록 5개·업무 6개 필드 수정→재검토→저장 JSON→새 문서 복원 일치.
- 저장은 ai-secretary:desktop-demo:v1 localStorage 키, 서버 저장 아님. mkdtemp/--user-data-dir 격리 확인 후 실행하여 사용자 기존 저장소 미접근.
- 저장 예외 안내·입력 유지·이전 저장본 보존 및 손상 데이터 덮어쓰기 잠금 통과. 상세 명령과 프로필 경로는 보고서.
### 남은 것
범위 내 결함 재현 없음. 실제 용량 소진·다중 탭·브라우저 재시작·시각/전체 접근성·IME 미검증. 설치·외부 전송·AI 실행 없음. 임시 테스트 프로필은 남음.
### 다음 행동
시연 시 수정 후 검토란을 다시 체크하고 확정 저장한다. 미검증 항목은 별도 요청 시 검증.


## 세션별 토큰 갱신 single-flight (2026-10-08)
### 목표
동일 세션 내 진행 중 갱신 요청만 공유하는 SessionApi wrapper 구현·검증.
### 한 것 (경로)
- src/auth/sessionRefresh.ts 및 sessionRefresh.test.ts 신규: Promise identity 공유, 동기 throw/reject network 정규화, 완료 전 해제, 재시도·인스턴스 격리·restoreSession 통합 9개 테스트.
- docs/open-decisions.md OD-25 추가(기존 최대 OD-24 확인, 팀 승인 아님). docs/plans/2026-09-28-myClaw-development-order.md 인증 단계에 로직 검증만 기록.
- 기존 session.ts/session.test.ts 및 web/scripts AI 변경은 수정하지 않음. 아래 기존 인계 내용 보존.
### 확인 명령 결과
- MyClaw read_file로 지침·인계·세션 코드·논의·계획 확인, bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인.
- npm run check 종료 0: 타입 검사 및 227/227 통과(신규 9개 포함). npm run test:web 종료 0: 8/8 통과. git diff --check 종료 0.
- auth SHA-256: sessionRefresh.ts = 1811e3b775e692a1f1fc695bd9cde491556eacd9f352af5e1587693ba5c0afc6; sessionRefresh.test.ts = ea01d7d48750d29a073e96aefe9ead16270e53947ba6aa549737f13766161bc5.
### 남은 것
화면·실제 서버·쿠키・401 재전송·다중 탭・로그아웃 미구현/미검증. wrapper만으로 오래된 응답의 새 세션 기록을 방지하지 못함. disposal은 별도 수명주기 작업. 커밋·배포·외부 전송 없음.
### 다음 행동
연결 시 세션/브라우저 컨텍스트에 wrapper 하나를 만들어 restoreSession과 향후 refresh가 공유하도록 한다. 로그인/로그아웃 경계에서는 별도 holder·wrapper 및 소비자의 이전 결과 무시를 별도로 설계·검증한다.


## 발화별 AI 분류·복수 업무 독립 검증 (2026-10-08, 실행 중)
### 목표
기존 10개 AI 입력·기대값·기준 실행기를 보존하고 발화별 분류와 복수 업무 정밀 검사를 로컬에서 검증한다. 웹 미적용·모바일 보류.
### 한 것 (경로)
- scripts/local-ai-classified-cases.mjs: 기준 10개 동등성 유지 + 새 대조 8개.
- scripts/local-ai-classified-contract.mjs 및 .test.mjs: 발화별 다중 라벨, 순서 무관 최대 일대일 업무 대응. 제목/담당자/기한/내용·배정 근거의 누락·중복·오연결 검사.
- scripts/verify-local-ai-classified.mjs: 전체 boolean 게이트 없이 분류→전체 원문 업무 추출. num_thread=2, 직렬, 요청 45초 제한, 과부하 중단, 실행별 원시 응답/오류 보존.
- scripts/test-helper.mjs 및 .test.mjs: 기존 --ai/--stt 보존, 독립 --ai-classified 옵션·보고서 판정 검사.
### 확인한 것과 방법
- MyClaw read_file로 HANDOFF/AGENTS/계획서, bash pwd로 프로젝트 절대 경로 확인. 기준 3개 파일 SHA-256은 작업 전후 동일.
- 계약/도구 57개 통과 후 제목 합침 반례 추가: 관련 부분 검사 38개 통과. 최종 통합 계약 수는 실행 결과로 재확인한다.
- npm run test:helper -- --ai-classified 종료 1. core 218/web 8/계약 58/browser 8 통과(각 종료 0). AI는 기존 10개 완료 후 multi_independent 추출 45초 timeout으로 중단: 11개 시도, 7개 미실행. 과부하 guard 발동은 아님.
- 실행 PID 90738(런처), 런처 로그 docs/test-runs/2026-10-08T02-18-36Z-classified-launch/launcher.log 및 exit-code.txt(완료 시 생성).
- 통합 폴더 docs/test-runs/2026-10-08T02-18-36.678Z-90751/.
- AI 원본 docs/test-runs/2026-10-08T02-18-41.478Z-ai-classified-HH9VYx/ai-classified.json. 실행 중 파일이므로 최종 hash 아님.
- ask_gemini는 설계 전 일반 설계만 질문했으나 응답 미수신. 대기 functions 실행 종료; Gemini 자체 완료/취소 미확인. 검토 확보 실패. design-review.md에 기록.
### 남은 것
추가 8개만 별도 실행 중(--additional-only --timeout-ms=90000). 첫 보고서는 보존. 업무 기대값/프롬프트/분류 계약은 변경하지 않고 실행 제한만 90초로 명시적으로 늘림. 2차 런처 PID 91933, docs/test-runs/2026-10-08T02-26-00Z-additional-launch/launcher.log 및 exit-code.txt 확인. 최종 회귀·sha256·계획서 기록 필요. 합성 외 품질·STT 종단·웹 연결 미검증.
### 다음 행동
중복 AI 실행하지 말고 추가 전용 실행 프로세스와 원본/통합 보고서 및 런처 exit-code.txt부터 확인한다. 과부하 중단이면 이번 실행에서 재시도하지 않는다.

## STT 의미·입력 오류 검사 보강 (2026-10-08)
### 목표
중단 지점의 숫자 의미·핵심 용어 보존 및 잘못된 PCM 입력 검사.
### 한 것 (경로)
- scripts/verify-stt.py: 기존 CER·키워드 기준 보존, 명시적 월/일 값 비교·핵심 용어 검사 추가. 선언된 프레임보다 짧은 PCM은 오류로 거부.
- scripts/test_stt_metrics.py: 날짜 동치/변경/누락/추가, 용어 오인식, PCM 정상·빈 음성·잘못된 형식·잘린 데이터·비음성·0바이트·없는 파일 검사. 총 24개.
- docs/plans/2026-10-08-desktop-demo.md: 상세 결과 기록.
### 확인한 것과 방법
- MyClaw read_file로 HANDOFF·AGENTS·계획·코드 확인, bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인.
- 확인한 기록에 사용자 승인 거절 없음. 과거 중단은 과부하 보호였고 이번 거절/과부하 없음.
- 최초 단위 테스트 23/24: 새 테스트의 바이트 리터럴 이스케이프 오류 수정 후 24/24 통과.
- 최종 npm run test:helper -- --stt 종료 1: 타입·218개, 웹 8개, 계약/도구 30개, Chrome 8개, STT 단위 24개 통과. STT 합성 2/5 통과·3개 품질 실패·실행 오류 0. AI 옵션 미선택으로 미실행.
- 최종 보고서: docs/test-runs/2026-10-08T01-54-45.536Z-79763/report.json 및 stt.json. 첫 보강 실행 2026-10-08T01-54-01.339Z-79377도 보존.
- 이름/기한 용어, 맡지→맞지, 기한은→기아는 검출. 10월 12일 날짜 값은 보존. 기존 CER/키워드를 느슨하게 하지 않았고 추가 의미 검사 때문에 기존 4/5와 통과율 직접 비교 금지.
- CPU 2스레드/작업자 1·로컬 모델만 사용. 추가 설치·다운로드·외부 음성 전송 없음.
### 남은 것
날짜 검사는 명시적 월/일의 제한된 표기만 지원하며 달력 유효성·상대 날짜·일반 숫자 의미 검사가 아님. 용어 검사는 문자열 보존이지 전체 의미 판정이 아님. 잘못된 입력은 PCM 경계 단위 검사이며 웹 업로드 연결 검사가 아님. 실제 회의·발화 경계·AI 개선·종단 비교·웹 실제 연결 미완료. 모바일 보류.
### 다음 행동
기존 10개 AI 기대값을 유지하며 발화별 필요성·거절·배정 변경 개선안과 복수 업무 반례를 검증한 뒤 정답/STT 전사 종단 비교. 전체 4단계 진행 중.


## STT 재개 실측 (2026-10-08)
### 목표
중단된 STT 실행 상태 확인 및 웹 테스트 지원 도구 통합 검증.
### 한 것 (경로)
- scripts/test-helper.test.mjs: STT 완료·누락/중복·품질 실패·실행 오류 판정 회귀 테스트 5개 추가.
- docs/plans/2026-10-08-desktop-demo.md: 실측 결과와 남은 검증 기록.
### 확인한 것과 방법
- read_file로 지침·인계·계획·현재 코드 확인, MyClaw bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인.
- model-download.log에서 MODEL_READY 확인. ps 조회 시 기존 다운로드/STT 실행 프로세스는 검색되지 않음.
- 기존 docs/test-runs/2026-10-08T01-11-13.049503Z-stt/report.json은 complete=true지만 PyAV metadata_errors 호환 오류 5건. 품질 실측 성공이 아님.
- 현재 verify-stt.py에는 PCM 배열 입력·cpu_threads=2·num_workers=1·STT_REPORT_PATH가, test-helper.mjs에는 --stt 통합이 이미 반영되어 있었음. 아래 '반영되지 않음' 기록은 현재 상태와 다르며 반영 주체/시점은 미확인.
- npm run test:helper -- --stt 실제 종료 1: 타입·218개, 웹 8개, 계약/도구 30개, Chrome 8개, Python 지표 8개 통과. STT 4/5 통과·1개 품질 실패·실행 오류 0. AI는 옵션 미선택으로 미실행.
- 보고서: docs/test-runs/2026-10-08T01-42-02.732Z-70291/report.json 및 stt.json. git diff --check 종료 0.
- 합성 한국어 assignment CER 30.4%: 준호→중호, 기한은→기아는. 십월 십이일→10월 12일은 숫자 표기 차이도 점수에 포함됨. 기대값/정규화는 변경하지 않음.
- negation CER 7.1%, reversal 0%, necessity 6.7%, 침묵 출력 없음. 통과 사례에도 맡지→맞지, 기한은→기아는 오류가 남아 의미 정확성 전체 통과로 해석 금지.
- 사례당 1.85~2.25초, 음성 길이 대비 0.43~0.76배. 2스레드 설정이지 CPU 사용률 상한 보장 아님. 이번 승인 거절/과부하 오류 없음, 추가 설치·외부 음성 전송 없음.
### 남은 것
실제 회의·잡음/겹침/빠른 발화, 수동 발화 경계, 잘못된/빈 음성 입력 테스트, 숫자 의미 보존 별도 검사, AI 개선 및 STT→AI 종단 비교, 웹 실제 연결. 모바일 보류 유지.
### 다음 행동
기존 엄격 CER은 보존하고 숫자 의미·핵심 업무 용어 보존 및 PCM 입력 오류 검사를 추가한다. 이후 AI 개선안/종단 비교를 진행한다. 전체 4단계 진행 중.


## STT 준비 중 과부하로 중단 (2026-10-08)
### 목표
무료 로컬 STT 실측 및 테스트 지원 도구 확장. 모바일 보류 유지.
### 한 것 (경로)
- sources/stt-validation/venv: uv로 faster-whisper 1.2.1 및 의존성 설치 완료. sources/는 기존 gitignore 대상. 시스템 Python 변경 없음.
- sources/stt-validation/models: small 모델 다운로드 백그라운드 요청 PID 53406. 로그 model-download.log. 완료 미확인.
- scripts/verify-stt.py: Yuna 합성 한국어 4건·침묵 1건, CER·핵심어·시간·파일 해시·시각 범위 검사 작성. 수동 발화 경계 정확도는 미측정으로 명시.
- scripts/test_stt_metrics.py: CER 관련 단위 테스트 8개 추가.
### 확인한 것과 방법
- read_file로 HANDOFF/AGENTS/계획서, bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인.
- uv 설치 종료 0. Python 단위 테스트 8개 통과, git diff --check 종료 0.
- 다운로드 중간 조회에서 models 130MB, PID 실행 중 확인. MODEL_READY는 아직 확인 못함.
- 모델 PID 종료를 기다린 뒤 verify-stt.py를 실행하는 bash 요청이 진행 중(functions cell 8, timeoutSeconds=120). 최종 출력 미수신: 재개 시 기존 실행 상태·보고서부터 확인하여 중복 실행 방지.
- CPU 100% 과부하 보호로 MyClaw가 수정 거절. 사용자 승인 거절과 다름.
- verify-stt.py의 STT_REPORT_PATH 추가 및 test-helper.mjs --stt 통합 편집은 모두 오류 반환, 반영되지 않음. 통합 도구 기존 상태 유지.
### 남은 것
모델 다운로드 완료·STT 실행 결과 확인, CPU 제한 적용, 통합 도구 --stt 확장, 웹 회귀 테스트, 계획서 상세 기록. AI 개선안 미착수. 실측 성공 주장 금지.
### 다음 행동
부하 해제 후 지침·현재 파일·다운로드 로그·기존 STT 보고서 확인. STT 실행 전 cpu_threads=2, num_workers=1 등 부하 제한 추천. 필요 시 다운로드 동시성도 제한. 모델 준비 완료 후에만 로컬 전용 실측; 외부 음성 전송 없음.

갱신: 2026-10-08 / Asia/Seoul


## 정밀 검증·테스트 지원 도구 1차 (2026-10-08)
### 목표
STT·AI 오류 정밀 검증 착수와 웹 테스트 지원 도구 제작.
### 한 것 (경로)
- scripts/test-helper.mjs 및 .test.mjs, package.json: npm run test:helper [-- --ai]. 실행별 보고서·로그, 실패/오류/미실행 분리. 추가 패키지 없음.
- scripts/verify-local-ai-two-stage.mjs: AI_REPORT_PATH로 실행별 원시 결과를 보존. 프롬프트·기대값은 변경하지 않음.
- scripts/verify-browser.mjs: 이전 문서의 DOM 조건을 새로고침 완료로 오인하지 않도록 문서 교체·readyState 대기 추가.
- docs/plans/2026-10-08-desktop-demo.md: 도구 범위와 STT CER·핵심어·시각·처리 시간, AI 오류 분류·종단 검증 계획 추가.
### 확인한 것과 방법
- MyClaw read_file로 지침·인계·계획, bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인.
- 통합 도구 두 번 실행. AI는 각 5/10 통과로 실패 사례 동일. 최신 사례당 532~11,160ms. 고정 seed의 같은 합성 사례 2회이지 일반 품질 검증이 아님.
- 필요성 누락 2건, 담당자 오인, 배정 근거 누락, 번복 업무 중복이 남음. 스키마 실패 시 근거 관련 후속 검사도 함께 실패하므로 실패 체크 수를 독립 오류 건수로 합산하지 않는다.
- 최초 브라우저 실행은 4개 시나리오 후 새로고침 복원 assertion 실패. 이전 DOM을 통과시키는 대기 조건을 보완한 뒤 통합 1회+별도 2회에서 각각 8/8 통과. 앱 저장 결함으로 확정하지 않으며 웹 코드는 변경하지 않음.
- 최신 통합: 타입·218개, 웹 8개, 계약/도구 25개 통과. 브라우저 8개 통과. AI 실패로 종료 1, STT not_run을 통과로 집계하지 않음. git diff --check 종료 0.
- 결과: docs/test-runs/2026-10-08T00-44-12.789Z-21582/ (첫 실패 포함), docs/test-runs/2026-10-08T00-45-34.620Z-23681/ (최신). report.json·README.md·각 로그·ai-two-stage.json 보존.
- 현재 PATH의 whisper·whisper-cli·ffmpeg 및 python3의 whisper/faster_whisper/torch/transformers 없음. web·scripts 안 음성 파일 없음. 컴퓨터 전체 부재로 단정하지 않음. Ollama API에서 qwen2.5:7b 확인.
- 승인 거절 없음. 설치·모델 다운로드·외부 AI 전송·배포 없음.
### 남은 것
STT 실행기·음성·정답 전사 준비와 실제 음성 실측은 미실행. 발화별 분류 개선안·복수 업무·새 표현·실제 웹 AI 연결·시각/다중 탭 검증은 미완료. 테스트 도구는 CLI/파일 보고서 1차 버전이며 웹 내 테스트 화면은 아님.
### 다음 행동
무료 로컬 STT 환경과 합성 한국어 음성/정답 준비(다운로드 필요 시 승인 도구 사용), STT 실측. AI는 기존 기대값을 유지하며 발화별 분류안과 새 표현을 비교. 4단계 진행 중, 모바일 보류 유지.


## 2단계 추출 실험 (2026-10-08)
### 목표
업무 존재 판별과 필드 추출을 분리하고 업무 내용·배정 근거를 따로 검사한다.
### 한 것 (경로)
- scripts/verify-local-ai-two-stage.mjs, local-ai-two-stage-contract.mjs 및 .test.mjs 추가.
- scripts/local-ai-regression-cases.mjs: 기존 7개 입력·기대값 보존. 실행 시 순수 거절·거절 후 필요성·업무 자체 취소 3개 추가.
- docs/plans/2026-10-08-local-ai-two-stage-results.json: 원시 판별·추출 응답, 생략 여부, 검사·시간 기록. 기존 스크립트·기준 결과는 변경하지 않음.
### 확인한 것과 방법
- MyClaw read_file로 HANDOFF·AGENTS·계획서·관련 코드 확인. bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인, Ollama API에서 qwen2.5:7b 확인.
- node scripts/verify-local-ai-two-stage.mjs 종료 1, complete=true, 5/10 통과. 기존 7개 부분집합은 3/7. 이전 기준 결과는 과거 실행이며 이번 재실행 비교가 아님.
- 존재 판별 8/10: 필요성 발언과 거절 뒤 명시적 필요성 2개를 false로 잘못 판단. 거절·인사·업무 취소는 통과.
- 추출 실패: missing에서 발언자를 담당자로 오인, other_assignee에서 배정 근거 누락, reversal에서 취소된 배정까지 2개 업무로 반환.
- 사례당 540~12,738ms. 고정 합성 입력 단일 실행으로 일반 품질·재현성을 보증하지 않는다.
- npm run check 종료 0: 타입 검사·218개 통과. npm run test:web 종료 0: 8개 통과. 기존/신규 계약 검사 20개 통과. 구문·git diff --check 통과.
- 읽은 기록에 승인 거절 내역 없음. 이번 도구 호출도 거절 없음. 설치·외부 전송·배포 없음.
### 남은 것
2단계 방식은 거짓 음성으로 업무가 누락되므로 웹 적용하지 않음. negated_self는 거절+담당 미정이라는 모호성이 있으나 기존 기대 0을 유지하고 명확한 대조 사례를 추가했다. 키워드/날짜 형식 검사는 의미·실제 달력 유효성 전체를 보증하지 않음. STT·웹 연결·브라우저 재검증은 이번에 수행하지 않음.
### 다음 행동
업무 전체를 boolean 하나로 차단하지 않는 발화별 필요성·거절·배정 변경 분류안을 검증한다. 취소된 배정을 별도 업무로 만들지 않는 검사와 복수 업무 대조 사례를 추가하고, 동일 고정 사례 및 새 표현으로 비교한다. 4단계 진행 중, 모바일 연동 보류 유지.


## 구조화 추출 검증 (2026-10-08)
### 목표
빈 객체·근거 누락을 줄이기 위해 JSON 스키마와 원문 발화 ID를 적용한다.
### 한 것 (경로)
- scripts/verify-local-ai.mjs: 구조화 출력, 발화 ID, 업무 없는 입력, 제목·근거 검사 추가.
- scripts/local-ai-contract.mjs 및 .test.mjs: 필수 필드·알 수 없는/중복 ID·빈 값 검사와 단위 테스트.
- docs/plans/2026-10-08-local-ai-structured-results.json: 최종 결과. structured-initial-results.json은 첫 시도 보존. 기존 local-ai-results.json은 이전 결과로 보존.
### 확인한 것과 방법
- MyClaw bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인. Ollama 로컬 API에서 qwen2.5:7b 설치 확인 후 합성 입력만 사용.
- 최종 node scripts/verify-local-ai.mjs 종료 1: 7개 중 5개 통과, 2개 실패. 모든 출력은 형식 검사 통과. 사례당 757~4,830ms.
- 결정 번복: 최종 담당자·기한은 맞지만 업무 내용이 있는 s1 근거를 빠뜨림. 제목 단어가 근거에도 있는지 검사하여 실패로 기록.
- 거절만 있는 문장: 업무 후보를 만들어 count 검사 실패. 인사만 있는 입력은 빈 배열로 통과.
- 기존 negated_self의 무조건 업무 1개 기대는 잘못되어 0개로 정정했다. 이전 4/6과 단순 통과율 비교 금지. 필요성 발언은 확정 배정 아닌 담당 미정 후보로 유지.
- npm run check 종료 0: 타입 검사·218개 통과. npm run test:web 종료 0: 8개 통과. 새 계약 검사 12개 통과. 구문·git diff --check 통과.
- 첫 스키마 시도는 3/7, 시스템 지침 추가 후 6/7처럼 보였으나 제목 근거 검사 강화 후 최종 5/7. 결과 임의 보정 없음.
### 남은 것
업무 존재 여부 판별과 여러 발화에 걸친 근거 누락. 고정 7개 사례이며 제목 키워드 검사는 의미 정확성 전체를 보증하지 않는다. 날짜 검사는 형식만 확인한다. STT·실제 웹 연결·시각/복구 검증은 이번에 실행하지 않음.
### 다음 행동
업무 존재 판별과 필드 추출을 분리하는 방식을 검증하고, 번복 시 업무 내용·최종 배정 각각의 근거 ID를 요구한다. 현재 실패를 회귀 사례로 유지한다. 4단계 진행 중, 모바일 연동 보류. 설치·외부 전송·배포 없음.


## 검증 이어서 진행 (2026-10-08)
### 목표
담당자 누락 개선과 반례 검증. 모바일 실제 연동은 보류 유지.
### 한 것 (경로)
- scripts/verify-local-ai.mjs: 자기 담당 선언 지침, 다른 담당자·단순 발언·거절 반례 3개 추가. 기본 제목을 거르는 검사 추가.
- docs/plans/2026-10-08-local-ai-results.json: 최종 6개 실측 결과 저장.
### 확인한 것과 방법
- MyClaw bash pwd로 /Users/shiomiikuhiro/Projects/ai-secretary-app 확인. 로컬 Ollama 모델 조회 후 합성 입력만 실행.
- 최종 AI 실행 종료 1: 4/6 통과. 자기 담당 선언 준호 추출 성공. 결정 번복은 담당자·기한은 맞지만 인용 근거에 기한 없음. 단순 필요성 발언은 빈 객체 반환.
- 중간 실행에서 기본 제목 "할 일"을 성공으로 판정하는 검사 약점 발견, 검사 강화 및 지침 수정. 최종 제목 기본 문구 문제는 재현되지 않음.
- npm run check 종료 0: 타입 검사·218개 통과. npm run test:web 종료 0: 8개 통과. 브라우저 검증은 이번에 재실행하지 않음.
- 현재 PATH의 whisper·whisper-cli·ffmpeg 및 python3의 whisper·faster_whisper·torch·transformers 없음. 설치·다운로드하지 않음.
- 읽은 인계·계획에는 승인 거절 기록 없음. 이번 승인 거절도 없음. 최초 timeoutSeconds=180 요청은 도구 입력 제한 오류였고 120으로 재실행함.
### 남은 것
AI 근거 누락·빈 객체 처리, 부정 발언의 할 일 생성 여부와 제목 의미 검사, STT 실측, 웹 실제 연결·복구·시각 검증.
### 다음 행동
자유 JSON 대신 구조화 스키마와 문장 ID 기반 근거 추출 검증을 진행한다. 테스트 기대값을 느슨하게 하거나 AI 결과를 임의 보정해 통과시키지 않는다.

## 검증 재개 (2026-10-08)
### 목표
사용자 지시로 검증 단계 보류 해제. 모바일 실제 연동은 보류 유지.
### 한 것 (경로)
- scripts/verify-browser.mjs: 별도 Chrome 프로필·임시 서버에서 실제 브라우저 검증.
- scripts/verify-local-ai.mjs: 합성 문장 3개로 로컬 Ollama 추출 검증.
- docs/plans/2026-10-08-verification.md, 2026-10-08-local-ai-results.json: 범위·실패·실측 결과.
- docs/plans/2026-10-08-desktop-demo.md: 4단계 진행 중으로 갱신. 기존 웹 코드는 수정하지 않음.
### 확인한 것과 방법
- npm run check 종료 0: 타입 검사·218개 통과. npm run test:web 종료 0: 8개 통과.
- node scripts/verify-browser.mjs 종료 0: 실제 headless Chrome 8개 시나리오 통과. 근거 이동·검토·저장·새로고침 복원·주입한 저장 실패·손상 데이터 보호.
- 로컬 서버 curl HTTP 200. node --check 및 git diff --check 통과.
- Ollama 11434 로컬 API에서 0.35.1·qwen2.5:7b 확인. AI 검증 종료 1: 2/3 통과, 자기 담당 선언에서 준호 대신 null 반환. 최종 실측 3,821/2,512/4,987ms.
- STT 실행 도구는 현재 PATH와 python3 모듈에서 찾지 못함. 컴퓨터 전체 검색은 하지 않음.
### 남은 것
- STT 실행·AI 담당자 누락 개선·실제 웹 연결·다중 탭·시각 품질·리허설. 검증 전체는 진행 중.
- headless 브라우저 DOM 확인을 시각 검수나 전체 키보드 접근성 통과로 해석하지 말 것.
- 기존 사용자 저장 데이터는 건드리지 않음. 임시 테스트 프로필은 OS 임시 폴더에 남김. 추가 설치·외부 AI 전송·배포 없음.
### 다음 행동
담당자 추출 지침 개선 및 반례 추가 → STT 환경 마련·한국어 실측 → 실제 웹 연결·복구 검증. 아래 과거 기록의 검증 보류·브라우저 도구 없음 주장은 이 기록으로 대체한다.

## 컴퓨터 웹 첫 시연본 (2026-10-08)
### 목표
2026-10-12 발표를 위해 먼저 작동하는 웹을 만들고 정밀 검증은 별도 시간에 진행한다.
### 한 것 (경로)
- docs/plans/2026-10-08-desktop-demo.md: 이번 발표용 실행 범위·별도 검증 목록. 기존 전체 계획 보존.
- web/index.html, style.css, app.mjs, model.mjs, model.test.mjs: 예시 전사·근거 강조·회의록/할 일 편집·검토 확인·localStorage 저장·복원·오류 안내.
- scripts/serve-web.mjs, package.json: 외부 패키지 없는 로컬 웹 실행 및 웹 테스트 명령.
- 기존 src/ 도메인 로직은 수정·직접 연결하지 않았다. 현재 웹은 고정된 예시 전사 ID를 사용한다. 실제 처리 통합 시 기존 근거의 원본 버전 계약을 연결해야 한다.
### 확인한 것과 방법
- MyClaw bash: npm run check 종료 0, 타입 검사 및 기존 218개 테스트 통과.
- npm run test:web 종료 0, 신규 8개 테스트 통과(메모리 저장 어댑터 복원·오류·중복 방지·HTTP 자산/접근 제한). 실제 브라우저 localStorage 실측은 아님.
- node --check web/app.mjs 및 git diff --check 성공.
- node scripts/serve-web.mjs 백그라운드 시작 요청 PID 63867. curl로 http://127.0.0.1:4173/ HTML 응답 확인. 다음 대화에서 프로세스 존속 재확인 필요.
### 남은 것
- 브라우저 렌더링·클릭·새로고침 복원은 미검증(제공된 브라우저 도구 없음).
- 실제 녹음·STT·AI·음성 시각 연결은 미구현. 현재 화면은 항상 예시 표시.
- 단일 브라우저 localStorage만 사용. 기기 동기화·실제 계정 배정·알림·공개 배포는 미구현.
- STT·AI 정밀 검증과 모바일 실제 연동은 deferred. 별도 검증 크론 미예약.
- 이번 변경은 커밋·외부 업로드하지 않았다.
### 다음 행동
별도 검증 시간 합의 후 브라우저 사용 → STT → AI → 통합·실패 복구 순으로 검증한다. 보류 단계는 사용자가 재개하기 전 실행하지 않는다.

---
아래는 과거 인계 기록이다.

## 명세서 v5 규칙 코드 추가 (2026-10-06, 같은 브랜치)
### 결정 (최재원, 2026-10-06)
- 웹과 앱을 둘 다 만든다. 유료(Pro·Team)만 웹↔앱 연동. 백엔드 담당은 손주원·유병욱. 팀 역할은 Drive '역할 및 진행 사항' 시트(OD-02).
### 한 것 (새 파일, 모두 *.test.ts 포함)
- src/auth/verificationCode.ts: 인증번호 6자리·3분·5회 실패 무효·1회용·재발송 1시간 5회, 입력 정리·자동 제출·타이머 (DTL-AUT-021~026·047·048·052)
- src/auth/loginThrottle.ts: 로그인 빈 칸 검사, 통일 실패 문구, 5회 실패 10분 차단 (DTL-AUT-031·033·034)
- src/auth/tokenRefresh.ts: 401 자동 갱신(동시 만료 때 1회), 재로그인 뒤 복귀 경로 검사 (DTL-AUT-038·039)
- src/tasks/taskStatus.ts: 할 일 탭 분류, 기한 초과, 마감 임박 7일 (DTL-TSK-001, DTL-HOM-004, REQ-TSK-006)
- src/calendar/overlap.ts: 일정 겹침 안내, 남은 날 수 (REQ-CAL-005·014)
- src/inbox/memoInput.ts: 메모 10,000자, 빈 메모, 3초 미만 녹음 (DTL-INB-003·006, REQ-INB-016)
- src/review/suggestionStatus.ts: 제안 상태(확인 대기·승인·거절·보류), 일괄 처리, 확인 대기 개수 (REQ-UX-001·007~009·011)
- src/billing/plans.ts: 요금제 한도·이용량·한도 초과, 유료만 연동 (DTL-PAY-001, REQ-PAY-002~004)
- src/team/membership.ts: 마지막 관리자 나가기 제한, 내보내기, 나간 사람 할 일 담당 해제 (REQ-TEM-001·008~010, REQ-ACC-006)
### 확인한 것
- npm run check: 타입 검사 성공, 테스트 통과(PR 본문에 개수).
### 남은 것
- 역할별 권한 범위(REQ-TEM-006·007)는 역할 종류가 명세서에서 임시안이라 만들지 않았다(OD-25).
- 할 일 '진행 중' 상태(REQ-TSK-006)는 저장 형식에 칸이 없어 서버 담당과 정한 뒤 더한다.
- 앱(Flutter)에서 쓰는 방법(OD-26), 무료 사용자의 기기 간 유지 범위(OD-27).

## 명세서 v5 맞춤 (2026-10-06, 브랜치 spec-v5-alignment)
### 한 것
- 코드 주석의 초기 설정 번호를 명세서 v5로 고쳤다: REQ-SET-003→009(src/auth/session.ts), 008→015(src/contracts/items.ts), 009·010→018·019(src/settings/).
- 비밀번호 재설정이 인증번호 방식이 되어 DTL-AUT-049 버튼 이름을 [인증번호 받기]로 고쳤다(src/shared/cooldown.ts와 테스트 이름).
- 할 일 완료 해제는 명세서 REQ-TSK-005가 정해 [임시 가정] 표시를 뗐다(src/tasks/completion.ts와 테스트 이름).
- docs/open-decisions.md에 명세서 v5가 답한 OD-05·06·08·11·12·16·18·22의 결정을 적고, B2B·팀 협업 범위를 OD-25로 새로 올렸다.
- 계획서 4장 추적표의 REQ-SET 번호를 v5로 고쳤다.
### 확인한 것
- 코드 로직(문구·수치)을 명세서 v5 '상세 설계 참고' 탭과 대조했다. 가입 검증 문구, 약관 항목, 60초 대기, 파일 형식·용량, 휴지통 30일, 건너뛰기 기본값, 브리핑 기본값은 이미 같아 로직은 바꾸지 않았다.
- npm run check: 타입 검사 성공, 테스트 218개 통과, 실패 0.
### 남은 것
- 팀 협업(REQ-TEM)·계정 관리·메모·검색·요금제는 아직 계획과 코드에 없다(OD-25).
- 인증번호 3분·로그인 10분 차단은 아직 서버 쪽 코드가 없어 문서에만 반영했다.

## GitHub 공유 인계 (2026-10-05)
### 목표
현재까지의 작업을 새 비공개 GitHub 저장소로 조원과 공유한다.
### 한 것 (경로)
- 저장소: https://github.com/dbrdid/ai-secretary-app (origin, main).
- 기존 src/ 및 docs/ 변경을 a607175로 커밋하고 main에 업로드했다. 기능 코드는 추가 수정하지 않았다.
- sources/, attachments/, .env, node_modules/는 기존 .gitignore에 따라 제외했다.
- 이 HANDOFF.md에 공유 상태를 갱신했다.
### 확인한 것과 방법
- npm run check 재실행: 타입 검사 성공, 테스트 218개 통과, 실패 0.
- git diff --check 및 커밋 전 git diff --cached --check 성공.
- 작업 파일 58개와 기존 이력 blob 26개를 비밀정보 패턴 검사했다. 탐지된 비밀번호 리터럴은 테스트용 데이터임을 코드로 확인했다. 패턴 검사는 비밀정보 부재를 보증하지 않는다.
- GitHub API로 private=true 및 원격 main과 로컬 a607175 커밋 일치를 확인했다.
### 남은 것
- 조원 초대는 아직 하지 않았다. 비공개 저장소이므로 링크만으로는 조원이 접근할 수 없다.
- 실제 화면·서버 연결은 미검증이며 아래 개발 기록의 미결정을 유지한다.
### 다음 행동
- 이 인계 기록을 커밋·업로드한 뒤 원격 커밋 일치와 작업 트리 상태를 확인한다.
- 사용자에게 조원 GitHub 아이디와 접근 권한을 확인하여 초대한다.

---
아래는 2026-09-28 개발 기록이다. 당시의 미커밋 표기는 위 공유 기록으로 대체하며, 나머지 과거 검증 주장은 필요할 때 재확인한다.

갱신: 2026-09-28 / Asia/Seoul

## 목표
사용자가 붙인 기능 요구사항 50건을 화면·백엔드 의존성에 맞게 개발한다.
계획: docs/plans/2026-09-28-myClaw-development-order.md (단계 0~10, 50건 추적표).
사용자 지시(2026-09-28): 지금 당장 할 수 있는 것만 진행하고, 논의가 필요한 것·혼자 정하기 어려운 것은 따로 파일로 → docs/open-decisions.md.

## 한 것 (경로) — 모두 커밋하지 않음(작업 트리)
1. 단계 0 기반: src/contracts/(time·items·evidence·trash·itemStore) + src/adapters/fake/memoryItemStore.ts
2. 설정(DTL-SET-011·012·013): src/settings/briefing.ts, timeZoneCheck.ts. src/onboarding/skipOnboarding.ts 수정(주간 브리핑 타입 확장).
3. 일정·할 일(DTL-CAL-003·002, TSK-002): src/calendar/recurrence.ts, dayAgenda.ts, src/tasks/completion.ts. 일정 형식에 반복·알림 칸 추가(src/contracts/items.ts).
4. 입력(DTL-INB-002·005·007): src/inbox/mentionTrigger.ts, recorder.ts, filePick.ts와 각 *.test.ts.
5. 인증(DTL-AUT-035·037): src/auth/session.ts — 로그인 유지 쿠키 규칙, 재진입 때 갈 화면(홈/초기 설정/로그인/다시 시도), Access 토큰 메모리 보관.
   가짜 서버 src/adapters/fake/fakeSessionServer.ts(세션 쿠키·14일 쿠키·회전·폐기를 흉내), src/auth/session.test.ts.
6. 논의 파일 docs/open-decisions.md (OD-01~24). 코드 주석의 OD 번호가 여기를 가리킨다.
7. 스토리보드: 사용자가 알려 준 /Users/shiomiikuhiro/Desktop/모바일프로젝트 는 파일이 아니라 폴더이고, PNG 캡처 11장
   ('UI/UX 스토리보드' — 로그인·회원가입·이메일 인증·비밀번호 재설정·오류 문구·메인화면)이 들어 있다.
   이미지를 볼 도구가 없어 macOS Vision 글자 인식(osascript JXA)으로 읽었다 → sources/storyboard-2026-09-28-ocr.txt.
   이 파일은 git status에 나타나지 않는다(sources/가 무시 목록인 것으로 추정). 원본 이미지는 복사하지 않았다.

## 확인한 것과 방법
- npm run check 실제 실행(set -o pipefail): 타입 검사 통과, 테스트 218개 통과·실패 0.
  이번 대화 첫 실행 204개(입력 테스트 34개 추가) → 세션 테스트 14개 추가 후 218개.
- git diff --check 오류 없음. 새 src·docs 파일에 줄끝 공백 없음.
- 코드의 OD 번호(01·03·07·09·10·13·14·15·16·17·19·20·21)가 모두 docs/open-decisions.md 제목에 있음(grep 대조).
- 스토리보드 ↔ 상세 설계(sources/sheet2_상세설계참고.csv) 대조 결과는 OD-05~08·11·12·22·24.
  주요 차이: 인증 코드 3분/10분, 로그인 잠금 10분/15분, 가입 뒤 로그인 화면/자동 로그인+초기 설정, 재설정 코드/링크,
  Remember = 비밀번호 저장/토큰 14일, 하단 탭 메모/프로젝트.
- 미검증: 스토리보드의 아이콘·배치·색(글자만 읽음, 소셜 버튼 TALK·N·G는 추정), 실제 서버·브라우저 쿠키 동작(가짜 서버 통과일 뿐), 화면 연결.

## 임시 가정 (논의 파일에 올림)
- 세션: 네트워크 오류면 로그아웃시키지 않고 retry, 만료 문구는 서버가 expired/invalid를 알릴 때만, 14일은 로그인 때부터(가짜 서버) — OD-07.
- 스토리보드와 다른 곳은 코드가 상세 설계를 따른다(OD-12 추천). 스토리보드의 '이메일·비밀번호 자동 저장'은 구현하지 않는다(보안).
- 이전 가정: 주간 시각 30분 단위 미강제·끄면 값 유지(OD-09), 완료를 다시 누르면 해제(OD-16), 월말 반복·관련 메모 기준은 인자(OD-13·15).

## 남은 것
- 사용자·팀 결정: docs/open-decisions.md '먼저 정할 것' 7건(OD-01·03·05·06·08·12·22).
- 계획서 50건 상태는 여전히 '계획됨' — 로직만 있고 화면·서버 연결 전이다.
- 지금 할 수 있는 다음 후보(상세 설계 규칙 충분): DTL-AUT-038 Access 토큰 자동 갱신(동시 만료 때 갱신 1회), DTL-AUT-039 재로그인 뒤 보던 화면으로 복귀.
- 커밋하지 않았다. 커밋 여부는 사용자에게 맡긴다.

## 다음 행동
1. 사용자가 '먼저 정할 것'에 답하면 해당 코드의 [임시 가정]·테스트를 고치고 open-decisions.md에 결정을 적는다.
2. 답을 기다리는 동안 DTL-AUT-038부터(src/auth/). update_plan의 plan에 2026-09-28-myClaw-development-order.md를 지정한다.
