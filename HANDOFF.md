# HANDOFF — 개인형 AI 비서 앱
갱신: 2026-09-28 밤 / Asia/Seoul

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
