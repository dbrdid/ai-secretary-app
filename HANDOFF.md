# HANDOFF — 개인형 AI 비서 앱
갱신: 2026-10-05 / Asia/Seoul

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
