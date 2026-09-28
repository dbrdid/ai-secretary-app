#!/usr/bin/env python3
"""계획서(docs/plans/2026-09-27-ai-secretary-mvp.md)를 sources/ 원문 사본과 대조한다.

왜 있나: 계획서의 ID·건수·인용은 원문 사본에서 옮겨 적은 것이라 틀릴 수 있다.
이전 검증 스크립트는 /tmp 에 두었다가 재부팅으로 사라졌다. 다시 돌릴 수 있게 워크스페이스에 둔다.
실행: 워크스페이스 루트에서 `python3 scripts/verify_plan.py`. FAIL 이 하나라도 있으면 종료 코드 1.
한계: 사본만 본다. 원문(구글 문서·시트)이 바뀌었으면 sources/ 를 다시 받은 뒤 돌린다.
"""
import collections
import csv
import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAN = ROOT / 'docs/plans/2026-09-27-ai-secretary-mvp.md'
SRC = ROOT / 'sources'
DT = '상세 내용 (상세 설계 단계 확정 필요)'
RT = '상세 요구사항 및 인수 조건 (Acceptance Criteria)'


def load(name):
    with open(SRC / name, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


dtl_rows = load('sheet2_상세설계참고.csv')
req_rows = load('sheet2_gid1956521169.csv')
dtl = {r['상세 ID']: r for r in dtl_rows}
req = {r['요구사항 ID']: r for r in req_rows}


def kind(row):
    # 시트 표기 '기능(Func)'·'API' 등에서 괄호 앞만 쓴다. 계획서는 괄호 앞 이름으로 적는다.
    return row['분류(Type)'].split('(')[0].strip()


def parents(d):
    return re.findall(r'REQ-[A-Z]+-\d{3}', dtl[d]['상위 요구사항 ID'])


FUNC = sorted(d for d in dtl if kind(dtl[d]) == '기능')
REQ_FUNC = sorted(r for r in req if kind(req[r]) == '기능')
plan = PLAN.read_text(encoding='utf-8')
fails = []


def check(ok, msg):
    print(('OK   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


# 계획서는 'DTL-AUT-014·016', 'REQ-AUT-001~017', 'DTL-AUT-027※·030' 같은 줄임 표기를 쓴다.
ID_RE = re.compile(r'(DTL|REQ)-([A-Z]+)-(\d{3})((?:\s?※)?(?:[·~]\d{3}(?:\s?※)?)*)')


def expand(text):
    out = []
    for m in ID_RE.finditer(text):
        pfx, cat, first, rest = m.groups()
        nums = [int(first)]
        for sep, n in re.findall(r'([·~])(\d{3})', rest):
            n = int(n)
            nums.extend(range(nums[-1] + 1, n + 1) if sep == '~' else [n])
        out.extend(f'{pfx}-{cat}-{n:03d}' for n in nums)
    return out


def section(start, end):
    s = re.search(start, plan, re.M)
    if not s:
        return ''
    e = re.search(end, plan[s.end():], re.M)
    return plan[s.start(): (s.end() + e.start()) if e else len(plan)]


def text_of(i):
    r = dtl.get(i) or req.get(i)
    return (r.get(DT) or r.get(RT) or '') + ' ' + (r.get('비고') or '')


# ---------- 1. 시트 기본 수치 (2장, E2, D9) ----------
check(len(req) == 82 and len(dtl) == 115, f'시트 행 수 REQ {len(req)}, DTL {len(dtl)} (82/115)')
cnt_req = collections.Counter(kind(r) for r in req.values())
cnt_dtl = collections.Counter(kind(r) for r in dtl.values())
check(cnt_req == {'기능': 52, '예외': 15, '흐름': 9, '비기능': 6}, f'요구사항 분류 {dict(cnt_req)}')
check(cnt_dtl == {'UI': 29, '기능': 29, '예외': 23, 'API': 13, '검증': 9, '보안': 7, '옵션': 5},
      f'상세 설계 분류 {dict(cnt_dtl)}')
auth = collections.Counter(kind(r) for r in dtl.values() if r['대분류'] == '인증')
check(auth == {'UI': 12, '예외': 14, '기능': 9, '검증': 9, 'API': 7, '보안': 7, '옵션': 1}, f'E2 인증 분류 {dict(auth)}')
api = collections.Counter(r['대분류'] for r in dtl.values() if kind(r) == 'API')
check(api == {'인증': 7, '초기 설정': 1, 'AI 처리': 3, '확인형 AI': 1, 'AI 비서': 1}, f'D9 API 13건 분포 {dict(api)}')

sec2 = section(r'^### 요구사항과 상세 설계', r'^- 요구사항 열')
table2 = {}
for line in sec2.splitlines():
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    if len(cells) != 6:
        continue
    for i in (0, 3):
        name, r_n, d_n = cells[i:i + 3]
        if name and r_n.isdigit() and d_n.isdigit():
            table2[name] = (int(r_n), int(d_n))
creq = collections.Counter(r['대분류'] for r in req.values())
cdtl = collections.Counter(r['대분류'] for r in dtl.values())
check(table2 == {k: (creq[k], cdtl[k]) for k in creq}, f'2장 대분류 표 {len(table2)}행 = 시트')

# ---------- 2. 계획서의 ID가 시트에 있는지 ----------
ids = set(expand(plan))
missing = sorted(i for i in ids if i not in dtl and i not in req)
check(set(missing) <= {'REQ-SEC-002', 'DTL-SEC-002'},
      f'계획서 ID {len(ids)}개 가운데 시트에 없는 것 {missing} (E1의 오류 사례만 허용)')

# ---------- 3. 표 A ----------
secA = section(r'^\*\*표 A', r'^\*\*표 B')
rowsA = re.findall(r'^\| (\d) \| (DTL-[A-Z]+-\d{3})( ※)? \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$', secA, re.M)
check(len(rowsA) == 29, f'표 A {len(rowsA)}행 (29)')
stageA = {d: int(st) for st, d, *_ in rowsA}
check(sorted(stageA) == FUNC, '표 A ID = 상세 설계 탭 분류 기능 29건')
starA = {d for _, d, star, *_ in rowsA if star}
bad = []
for st, d, star, name, par, linked in rowsA:
    if name.strip() != dtl[d]['기능명'].strip():
        bad.append(f'{d} 기능명')
    pids = expand(par)
    if sorted(pids) != sorted(parents(d)):
        bad.append(f'{d} 상위 {pids}≠{parents(d)}')
    labels = re.findall(r'\((기능|흐름|예외|비기능)\)', par)
    if not labels or any(kind(req[p]) != labels[-1] for p in pids):
        bad.append(f'{d} 상위 분류')
    for grp, lab in re.findall(r'((?:DTL|REQ)-[A-Z]+-\d{3}(?:[·~]\d{3})*)\((UI|API|검증|보안|옵션|예외|기능)\)', linked):
        for x in expand(grp):
            src = dtl.get(x) or req.get(x)
            if src is None or kind(src) != lab:
                bad.append(f'{d} 맞물림 {x}({lab})')
check(not bad, f'표 A 기능명·상위 요구사항·맞물림 분류 일치 {bad}')
nonfunc_parent = {d for d in FUNC if any(kind(req[p]) != '기능' for p in parents(d))}
check(starA == nonfunc_parent == {'DTL-AUT-027', 'DTL-AUT-038', 'DTL-SET-014'},
      f'※ = 상위 요구사항이 기능이 아닌 것 {sorted(starA)}')

# ---------- 4. 5장 단계 목록 = 표 A ----------
sec5 = section(r'^## 5\. ', r'^## 6\. ')
parts = re.split(r'^- \[ \] \*\*단계 (\d)', sec5, flags=re.M)
listed_total = 0
for st, body in zip(parts[1::2], parts[2::2]):
    m = re.search(r'육양님 (\d+)건: ([^\n]+)', body)
    if not m:
        continue
    # '. 그리고 …' 뒤는 그 단계의 담당 항목이 아니라 덧붙인 설명이라 뺀다.
    got = expand(m.group(2).split('. ')[0])
    want = sorted(d for d, s in stageA.items() if s == int(st))
    listed_total += len(got)
    check(sorted(got) == want and int(m.group(1)) == len(want), f'5장 단계 {st}: {len(got)}건 = 표 A')
check(listed_total == 29, f'5장 단계 합계 {listed_total} (29)')

# ---------- 5. 표 C와 요구사항 탭 기준 수치 (4-1) ----------
secC = section(r'^\*\*표 C', r'^### 4-2\.')
tableC = sorted({i for i in expand(secC) if i.startswith('REQ-')})
linked_dtl = collections.defaultdict(set)
for d in dtl:
    for p in parents(d):
        linked_dtl[p].add(d)
wantC = sorted(r for r in REQ_FUNC if not any(kind(dtl[d]) == '기능' for d in linked_dtl[r]))
check(tableC == wantC and len(wantC) == 26, f'표 C {len(tableC)}건 = 계산 {len(wantC)}건')
core = [d for d in FUNC if all(kind(req[p]) == '기능' for p in parents(d))]
check(len(core) == 26, f'두 탭 모두 기능인 핵심 {len(core)}건 (26)')
under = {d for d in dtl if any(kind(req[p]) == '기능' for p in parents(d))}
c76 = collections.Counter(kind(dtl[d]) for d in under)
check(len(under) == 76 and c76 == {'기능': 26, 'UI': 24, 'API': 11, '검증': 8, '옵션': 5, '예외': 2},
      f'요구사항 탭 기준 연결 상세 설계 {len(under)}건 {dict(c76)}')

# ---------- 6. 4장 WP 표 ----------
secWP = section(r'^## 4\. ', r'^### 4-1\.')
wp_lines = [l for l in secWP.splitlines() if re.match(r'^\| WP\d+ ', l)]
check(len(wp_lines) == 12, f'WP 표 {len(wp_lines)}행 (12)')
bad, seen, prio_of = [], collections.Counter(), {}
for l in wp_lines:
    c = [x.strip() for x in l.strip().strip('|').split('|')]
    reqs = set(expand(c[1]))
    ds = {d for d in dtl if set(parents(d)) & reqs}
    seen.update(ds)
    r_n, d_n = map(int, c[2].replace('*', '').split('/'))
    mine = [d for d in ds if kind(dtl[d]) == '기능']
    star = [d for d in mine if d in starA]
    m = re.match(r'(\d+)건(?:\(※(\d+)\))?', c[5])
    decl, decl_star = (int(m.group(1)), int(m.group(2) or 0)) if m else (0, 0)
    ref = sum(kind(req[r]) == '기능' for r in reqs)
    if (len(reqs), len(ds), len(mine), len(star), ref) != (r_n, d_n, decl, decl_star, int(c[6])):
        bad.append(f'{c[0]}: 계산 {len(reqs)}/{len(ds)} 기능 {len(mine)}(※{len(star)}) 참고 {ref}')
    # 우선순위 칸은 'P0: … / P1: …'처럼 나뉜다. 그 요구사항이 적힌 조각의 P를 쓰고,
    # 'P1'처럼 한 값만 있으면 그 값을 쓴다. '나머지 P1' 같은 서술은 해석하지 않는다(None).
    segs = c[3].split(' / ')
    for r in reqs:
        p = None
        for s in segs:
            if r in expand(s):
                p = re.match(r'(P\d)', s).group(1)
        if p is None and ':' not in c[3]:
            p = re.match(r'(P\d)', c[3]).group(1)
        prio_of[r] = p
check(not bad, f'WP 12행의 REQ/DTL·기능·※·참고 건수 일치 {bad}')
check(len(seen) == 115 and max(seen.values()) == 1, 'WP 12개가 상세 설계 115건을 겹침 없이 나눔')

# ---------- 7. 4-3 지금 구현할 수 있는 범위 ----------
sec43 = section(r'^### 4-3\.', r'^## 5\. ')
parts = re.split(r'^\*\*([1-4])묶음', sec43, flags=re.M)
groups = {}
for k, body in zip(parts[1::2], parts[2::2]):
    rows = re.findall(r'^\| (DTL-[A-Z]+-\d{3})( ※)? \|([^\n]*)$', body, re.M)
    decl = int(re.search(r'\((\d+)건\)', body).group(1))
    groups[int(k)] = rows
    check(len(rows) == decl, f'4-3 {k}묶음 {len(rows)}행 = 제목의 {decl}건')
all43 = [d for rows in groups.values() for d, *_ in rows]
check(sorted(all43) == FUNC and len(set(all43)) == len(all43), '4-3 네 묶음 = 기능 29건, 중복 없음')
check([len(groups.get(k, [])) for k in (1, 2, 3, 4)] == [9, 8, 3, 9], '묶음 크기 9·8·3·9')
star43 = {d for rows in groups.values() for d, star, _ in rows if star}
check(star43 == starA, f'4-3 ※ 표시 = 표 A ※ {sorted(star43)}')
for k in (1, 2, 3, 4):
    dist = collections.Counter(stageA[d] for d, *_ in groups[k])
    print(f'     {k}묶음 단계 분포 {dict(sorted(dist.items()))}')
assumed = [d for d, _, rest in groups[1] if rest.rstrip(' |').split('|')[-1].strip() != '없음']
check(len(assumed) == 6 and '6건은 임시 가정' in sec43, f'1묶음 임시 가정 {len(assumed)}건 {assumed}')
bad = []
for d, _, rest in groups[4]:
    p_decl = rest.split('|')[0].strip()
    ps = {prio_of.get(p) for p in parents(d)}
    if ps != {p_decl}:
        bad.append(f'{d} {p_decl} vs WP {ps}')
check(not bad, f'4묶음 우선순위 = 4장 WP 표 {bad}')
g1 = {d for d, *_ in groups[1]}
g2 = {d for d, *_ in groups[2]}
st1 = {d for d, s in stageA.items() if s == 1}
m1 = re.search(r'6건\(([^)]*)\)이 1묶음', sec43)
m2 = re.search(r'나머지 3건\(([^)]*)\)은 2묶음', sec43)
m3 = re.search(r'1묶음의 (DTL-UX-003·004)\(단계 2\)와 (DTL-AUT-049)\(단계 3\)', sec43)
check(bool(m1) and set(expand(m1.group(1))) == st1 & g1, '5장 관계: 단계 1 가운데 1묶음 6건')
check(bool(m2) and set(expand(m2.group(1))) == st1 - g1 and (st1 - g1) <= g2, '5장 관계: 단계 1의 나머지 3건은 2묶음')
check(bool(m3) and set(expand(m3.group(1)) + [m3.group(2)]) == g1 - st1
      and all(stageA[d] == 2 for d in expand(m3.group(1))) and stageA['DTL-AUT-049'] == 3,
      '5장 관계: 앞당기는 3건과 그 단계')
# 4-3 본문이 '(DTL-…)' 앞에 붙인 역할 이름(API·검증·화면 등)이 시트 분류와 맞는지
role = {'DTL-SET-004': 'API', 'DTL-AUT-032': 'API', 'DTL-AUT-047': 'API', 'DTL-AUT-004': 'API',
        'DTL-UX-006': 'API', 'DTL-AUT-031': '검증', 'DTL-AUT-013': 'UI', 'DTL-AUT-015': 'UI',
        'DTL-AUT-036': '보안', 'DTL-AUT-040': '보안', 'DTL-AUT-035': '옵션',
        'DTL-AUT-003': '검증', 'DTL-AUT-006': '검증', 'DTL-AUT-008': '검증', 'DTL-AUT-009': '검증',
        'DTL-AUT-011': '검증', 'DTL-AUT-012': '검증', 'DTL-TSK-001': 'UI', 'DTL-HOM-001': 'UI',
        'DTL-BRF-001': '기능', 'DTL-UX-002': 'UI'}
bad = [f'{i}: {kind(dtl[i])}≠{k}' for i, k in role.items() if kind(dtl[i]) != k]
check(not bad, f'4-2·4-3 본문의 역할 이름 = 시트 분류 {bad}')

# ---------- 8. 4-2 ②④⑧의 '시트에 없다' 근거 ----------
def having(word):
    return sorted(i for i in list(dtl) + list(req) if word in text_of(i) and i.startswith('DTL'))


check(having('마감 임박') == ['DTL-BRF-001', 'DTL-HOM-001', 'DTL-TSK-001'], f"⑧ '마감 임박' 상세 설계 {having('마감 임박')}")
check(having('중요 메모') == ['DTL-BRF-001', 'DTL-HOM-001'], f"⑧ '중요 메모' 상세 설계 {having('중요 메모')}")
check(having('관련 메모') == ['DTL-CAL-002'], f"⑧ '관련 메모' 상세 설계 {having('관련 메모')}")
imminent = [i for i in list(dtl) + list(req) if '임박' in text_of(i)]
check(not any(re.search(r'\d', text_of(i)) for i in imminent), f'⑧ 임박이 나오는 {len(imminent)}건에 기간 숫자 없음')
hits = sorted({i for i in list(dtl) + list(req)
               if re.search(r'마감[^.]{0,15}\d|\d+\s*(일|시간)\s*(전|이내|남은)', text_of(i))})
print(f'     (참고) 마감·기간 숫자 패턴이 있는 항목: {hits}')
ux2, ai5 = dtl['DTL-UX-002'][DT], dtl['DTL-AI-005'][DT]
check("'추출된 제목'" in ux2 and "'일시'" in ux2 and '제목' not in ai5 and '일시' not in ai5 and '시각' not in ai5,
      '② 카드는 제목·일시를 보이는데 DTL-AI-005 추출 항목에는 제목·일시가 없음')
resend = sorted(i for i in list(dtl) + list(req) if '재발송' in text_of(i))
over = sorted(i for i in resend if re.search(r'초과|넘|한도', text_of(i)))
check(over == [], f'④ 재발송 항목 {resend} 가운데 초과 처리를 적은 것 없음')

# ---------- 9. D2 웹 전제 목록과 4-2 ⑥ ----------
d2_line = next(l for l in plan.splitlines() if l.startswith('| D2 |'))
d2_ids = expand(d2_line.split('이 가운데')[0])
m6 = re.search(r'6건이 담당이다\(([^)]*)\)', plan)
check(len(d2_ids) == 12 and bool(m6) and set(expand(m6.group(1))) == set(d2_ids) & set(FUNC),
      f'D2 웹 전제 {len(d2_ids)}건, 그 가운데 담당 {sorted(set(d2_ids) & set(FUNC))} = 4-2 ⑥')
check(not (g1 & set(d2_ids)), '1묶음은 웹 전제 12건과 겹치지 않음')
webish = sorted(i for i in dtl if re.search(r'웹|브라우저|페이지', text_of(i)))
print(f"     (참고) '웹|브라우저|페이지'가 나오는 상세 설계 {len(webish)}건: {webish}")
print(f'     (참고) D2 목록과의 차이: 목록에만 {sorted(set(d2_ids) - set(webish))}, 검색에만 {sorted(set(webish) - set(d2_ids))}')

# ---------- 10. 인용 문구 ----------
corpus_parts = []
for p in ['doc1.txt', 'doc3.txt']:
    corpus_parts.append((SRC / p).read_text(encoding='utf-8', errors='replace'))
for p in ['doc1.html', 'doc3.html']:
    raw = (SRC / p).read_text(encoding='utf-8', errors='replace')
    corpus_parts.append(html.unescape(re.sub(r'<[^>]+>', ' ', raw)))
for rows in (dtl_rows, req_rows):
    for r in rows:
        corpus_parts.extend(v for v in r.values() if v)


def norm(s):
    return re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()


corpus = norm(' '.join(corpus_parts))
corpus_nospace = corpus.replace(' ', '')
# 원문 인용이 아닌 따옴표: 프로젝트 이름과 육양님(사용자)의 말. 원문에 없어도 맞다.
NOT_SOURCE = {'모바일프로젝트', '분류 카테고리에서 기능 면'}
dq = re.findall(r'"([^"\n]{1,200})"', plan) + re.findall(r'「([^」\n]{1,200})」', plan)
dq_miss = sorted({q for q in dq if norm(q) not in corpus and norm(q).replace(' ', '') not in corpus_nospace} - NOT_SOURCE)
check(not dq_miss, f'큰따옴표·낫표 인용 {len(dq)}개가 원문에 있음 (원문에 없는 것 {dq_miss})')
sq = re.findall(r"'([^'\n]{1,60})'", plan)
sq_miss = sorted({q for q in sq if norm(q) not in corpus and norm(q).replace(' ', '') not in corpus_nospace})
print(f'     (참고) 작은따옴표 {len(sq)}개 가운데 원문에 없는 것: {sq_miss}')

print(f'\n결과: FAIL {len(fails)}건')
sys.exit(1 if fails else 0)
