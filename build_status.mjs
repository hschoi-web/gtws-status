// GTWS status.json / status-en.json 생성기
// 원천: 라이더스 어드민 리포트 https://admin.rideus.net/shuttlebus-report/gtws (서버 렌더 HTML, 인증 불필요)
//  - 2026-08-06 원천 교체: 노션 "GTWS 예약현황" DB → 어드민 리포트. NOTION_TOKEN 불필요.
//  - 어드민 표는 운행 시간표 전체를 담고 있음: 해당 시각에 정차하지 않는 탑승지는 "-", 정차하면 숫자(0 포함).
//    → 예약 0인 회차도 시간표대로 노출됨(이전 노션 방식은 예약>0만 회차로 잡아 시간표가 누락됐음).
//  - 탑승지 셀은 (예약자, 좌석) 2칸. 달성률 기준 "최소 운행 인원"은 실제 탑승 인원 = **좌석**.
// 실행: node build_status.mjs   → status.json, status-en.json 생성

const SRC = process.env.GTWS_REPORT_URL || "https://admin.rideus.net/shuttlebus-report/gtws";
const MIN = 30;
const GAP_MIN = 120; // 같은 회차(한 버스가 순회)로 볼 정류장 간 최대 간격(분)

// 어드민 표 헤더의 탑승지명 → 표시용 라벨(ko/en) + 소속 노선.
// 어드민 헤더가 바뀌면 여기 키를 갱신해야 함(미등록 탑승지가 나오면 빌드가 경고 후 실패).
const STOPS = [
  { src: "KTX대전역",                   ko: "KTX대전역",                  en: "KTX Daejeon Station",                      route: "대전" },
  { src: "무주공용터미널 맞은편 폭포 광장", ko: "무주공용터미널 맞은편 폭포 광장", en: "Muju Public Bus Terminal",              route: "무주 터미널" },
  { src: "천안 신세계백화점",             ko: "천안 신세계백화점",            en: "Shinsegae Dept. Store, Cheonan",           route: "천안/세종" },
  { src: "세종 BRT환승센터 맞은편",       ko: "세종 BRT환승센터 맞은편",      en: "BRT Transfer Center, Sejong",              route: "천안/세종" },
  { src: "광주 유스퀘어 맞은편",          ko: "광주 유스퀘어 맞은편",         en: "U-Square, Gwangju",                        route: "광주" },
  { src: "서울역",                       ko: "서울역 13번 출구",            en: "Seoul Station",                            route: "서울역" },
  { src: "종합운동장역 7번 출구",         ko: "종합운동장역 7번 출구",        en: "Sports Complex Station Exit 7",            route: "종합운동장역" },
  { src: "천호역 7번 출구",              ko: "천호역 7번 출구",             en: "Cheonho Station Exit 7",                   route: "종합운동장역" },
  { src: "상봉역 1번 출구",              ko: "상봉역 1번 출구",             en: "Sangbong Station Exit 1",                  route: "상봉역" },
  { src: "인천국제공항 T2",              ko: "인천국제공항 T2",             en: "Incheon Airport T2",                       route: "인천" },
  { src: "인천국제공항 T1",              ko: "인천국제공항 T1",             en: "Incheon Airport T1",                       route: "인천" },
  { src: "원인재역 1번 출구",             ko: "원인재역 1번 출구",           en: "Woninjae Station Exit 1",                  route: "인천" },
  { src: "백석역 2번 출구",              ko: "백석역 2번 출구",             en: "Baekseok Station Exit 2",                  route: "고양/김포" },
  { src: "김포국제공항 국제선",           ko: "김포국제공항 국제선",          en: "Gimpo Airport (Int'l)",                    route: "고양/김포" },
  { src: "의정부역 지하상가 6번출구",      ko: "의정부역 지하상가 6번출구",     en: "Uijeongbu Station Underground Mall Exit 6", route: "의정부" },
  { src: "별내역 2번 출구",              ko: "별내역 2번 출구",             en: "Byeollae Station Exit 2",                  route: "의정부" },
  { src: "부산역 지하철 4번 출구",         ko: "부산역 지하철 4번 출구",       en: "Busan Station Exit 4",                     route: "부산" },
  { src: "울산 태화로터리",               ko: "울산 태화로터리",             en: "Taehwa Rotary, Ulsan",                     route: "울산/대구" },
  { src: "대구 콘서트하우스",             ko: "대구 콘서트하우스",            en: "Daegu Concert House",                      route: "울산/대구" },
  { src: "KTX강릉역",                    ko: "KTX강릉역",                  en: "KTX Gangneung Station",                    route: "강릉/원주" },
  { src: "원주 치악예술관",               ko: "원주 치악예술관",             en: "Chiak Art Center, Wonju",                  route: "강릉/원주" },
];

// 노선 표시 순서 + 영문 노선명
const ROUTES = [
  { ko: "대전",         en: "Daejeon" },
  { ko: "무주 터미널",   en: "Muju Terminal" },
  { ko: "천안/세종",     en: "Cheonan / Sejong" },
  { ko: "광주",         en: "Gwangju" },
  { ko: "서울역",       en: "Seoul Station" },
  { ko: "종합운동장역",  en: "Sports Complex / Cheonho" },
  { ko: "상봉역",       en: "Sangbong Station" },
  { ko: "인천",         en: "Incheon" },
  { ko: "고양/김포",     en: "Goyang / Gimpo" },
  { ko: "의정부",       en: "Uijeongbu / Namyangju" },
  { ko: "부산",         en: "Busan" },
  { ko: "울산/대구",     en: "Ulsan / Daegu" },
  { ko: "강릉/원주",     en: "Gangneung / Wonju" },
];

// 어드민 표 제목 → 대시보드 방향
const DIR_OF_TABLE = { "하행선": "행사장행", "상행선": "귀가행" };

/* ---------------- HTML 파싱 ---------------- */
const norm = s => s
  .replace(/<[^>]*>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

function parseTables(html) {
  const out = [];
  const re = /<div class="report-table-title">([\s\S]*?)<\/div>([\s\S]*?)<\/table>/g;
  let m;
  while ((m = re.exec(html))) {
    const title = norm(m[1]), body = m[2];
    const thead = body.match(/<thead>([\s\S]*?)<\/thead>/);
    const tbody = body.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!thead || !tbody) continue;
    const headRow = thead[1].match(/<tr>([\s\S]*?)<\/tr>/)[1];
    const headers = [...headRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(x => norm(x[1]));
    const rows = [...tbody[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map(x => [...x[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(y => norm(y[1])));
    out.push({ title, headers, rows });
  }
  return out;
}

// 표 한 장 → [{date, time, seats:{탑승지: 좌석수}}] (정차하지 않는 "-" 칸은 제외)
function readTable(t) {
  const stopNames = t.headers.slice(2).filter(h => h !== "합계");   // 탑승일, 탑승시간 제외
  const unknown = stopNames.filter(s => !STOPS.some(x => x.src === s));
  if (unknown.length) throw new Error(`[${t.title}] 등록되지 않은 탑승지: ${unknown.join(", ")} — build_status.mjs STOPS 갱신 필요`);

  const rows = [];
  for (const cells of t.rows) {
    if (cells.length < 2 + stopNames.length * 2) continue;          // tfoot 합계행 등
    const rawDate = cells[0], time = (cells[1] || "").slice(0, 5);
    const dm = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dm || !/^\d{2}:\d{2}$/.test(time)) continue;
    const date = `${+dm[2]}.${dm[3]}`;                              // 2026-10-23 → 10.23
    const seats = {};
    stopNames.forEach((name, i) => {
      const seat = cells[2 + i * 2 + 1];                            // (예약자, 좌석) 중 좌석
      if (seat === "-" || seat === "") return;                      // 해당 시각 미정차
      seats[name] = Number(seat.replace(/,/g, "")) || 0;
    });
    if (Object.keys(seats).length) rows.push({ date, time, seats });
  }
  return rows;
}

/* ---------------- 회차 묶기 ---------------- */
const mins = t => { const m = String(t).match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : 0; };

// 행사장행: 한 버스가 여러 정류장을 순회 → 서로 다른 정류장이고 GAP_MIN 이내면 한 회차로 합산.
// 귀가행: 리조트 출발시각이 회차 기준 → 시각별로 그대로(묶지 않음).
//
// 날짜 경계를 넘어서도 묶음: 심야편은 원천에서 탑승일이 갈려 기록됨
// (예: KTX강릉역 10.23 23:00 → 원주 치악예술관 10.24 00:40 = 한 대). 절대 분(날짜×1440+시각)으로
// 한 줄에 세워 묶는다.
//
// 회차 귀속 날짜 = **마지막 정류장(=도착 쪽) 날짜** (olivia 확정 2026-08-06).
// 밤 버스는 타는 날이 아니라 **행사 당일(도착일)** 시간표에 있어야 한다. gtws 예약페이지도 이 기준.
// 예: 강릉 10.23 23:00 → 원주 10.24 00:40 은 **10.24 시간표**에 23:00으로 표기.
// (표시되는 dep 은 그대로 첫 출발시각 23:00 — 예약페이지와 동일)
function groupRuns(rows, stopSrcs, merge, dateIdx) {
  const perTime = [];
  for (const r of rows) {
    const stops = {}; let tot = 0;
    for (const s of stopSrcs) if (s in r.seats) { stops[s] = r.seats[s]; tot += r.seats[s]; }
    if (Object.keys(stops).length) perTime.push({ date: r.date, dep: r.time, stops, tot, abs: dateIdx.get(r.date) * 1440 + mins(r.time) });
  }
  perTime.sort((a, b) => a.abs - b.abs);

  const groups = [];
  for (const pt of perTime) {
    const g = groups[groups.length - 1];
    const keys = Object.keys(pt.stops);
    const overlap = g && keys.some(s => g.stopSet.has(s));
    const close = merge && g && (pt.abs - g.lastAbs <= GAP_MIN);
    if (g && close && !overlap) {
      g.booked += pt.tot; g.lastAbs = pt.abs; g.lastDate = pt.date;   // 도착 쪽 날짜로 갱신
      g.deps.push(pt.dep); keys.forEach(s => g.stopSet.add(s));
    } else {
      groups.push({ startDate: pt.date, lastDate: pt.date, dep: pt.dep, deps: [pt.dep], booked: pt.tot, lastAbs: pt.abs, stopSet: new Set(keys) });
    }
  }
  // 원천 범위 밖(첫날 이전 밤) 출발편의 '꼬리' 제거.
  // 리포트는 행사 기간(10.23~25) 탑승분만 담는다. 첫날 새벽에 뒤쪽 정류장만 단독으로 찍힌 회차는
  // 전날 밤 출발편의 뒷부분인데 그 출발편이 리포트에 없는 것 → 실제로는 운행하지 않는 유령 회차.
  // (예: 원주 치악예술관 10.23 00:40 단독 — 짝이 될 강릉 10.22 23:00 이 원천에 없음.
  //  올리비아 확인 2026-08-06 "행사가 23일부터야. 22일 밤 출발하는 강릉 노선은 하나도 없다")
  // 첫날이 아닌 날의 심야편(서울역 10.24 00:00 등)은 정상 회차이므로 건드리지 않는다.
  const firstDate = [...dateIdx.entries()].find(([, i]) => i === 0)?.[0];
  const kept = groups.filter(g => {
    const isTail = merge && g.lastDate === firstDate && mins(g.dep) < 300 && !g.stopSet.has(stopSrcs[0]);
    if (isTail) console.warn(`  · 제외(원천 범위 밖 꼬리): ${g.lastDate} ${g.dep} [${[...g.stopSet].join(", ")}] ${g.booked}석`);
    return !isTail;
  });
  return kept.map(g => ({ date: g.lastDate, dep: g.dep, deps: g.deps, booked: g.booked, prev: g.startDate !== g.lastDate, prevDate: g.startDate }));
}

/* ---------------- 빌드 ---------------- */
const dayKey = d => { const m = String(d).match(/^(\d+)\.(\d+)/); return m ? +m[1] * 100 + +m[2] : 9999; };

function build(byDir, lang) {
  const dates = [...new Set(Object.values(byDir).flat().map(r => r.date))].sort((a, b) => dayKey(a) - dayKey(b));
  const dateIdx = new Map(dates.map((d, i) => [d, i]));               // 날짜 경계를 넘는 회차 묶기용

  const days = {};
  for (const d of dates) days[d] = { "행사장행": {}, "귀가행": {} };

  for (const dir of ["행사장행", "귀가행"]) {
    const rows = byDir[dir] || [];
    if (!rows.length) continue;
    const runsDates = new Set(rows.map(r => r.date));                 // 이 방향이 운행하는 날짜(예: 10.23 귀가행 없음)

    for (const route of ROUTES) {
      const stops = STOPS.filter(s => s.route === route.ko);
      // 이 표(방향)에 실제로 존재하는 탑승지만 라벨에 사용 (귀가행엔 세종 정류장 없음)
      const present = stops.filter(s => rows.some(r => s.src in r.seats));
      const label = lang === "en" ? route.en : route.ko;
      const stopsLabel = (present.length ? present : stops).map(s => s[lang === "en" ? "en" : "ko"]).join("+");
      for (const d of dates) if (runsDates.has(d)) days[d][dir][label] = { stops: stopsLabel, runs: [] };

      for (const g of groupRuns(rows, stops.map(s => s.src), dir === "행사장행", dateIdx)) {
        const card = days[g.date][dir][label];
        card.runs.push({ run: `${card.runs.length + 1}회차`, dep: g.dep, deps: g.deps, booked: g.booked, ...(g.prev ? { prev: true, prevDate: g.prevDate } : {}) });
      }
    }
  }
  return days;
}

/* ---------------- 실행 ---------------- */
const res = await fetch(SRC, { headers: { "User-Agent": "gtws-status-builder" } });
if (!res.ok) throw new Error(`원천 조회 실패: ${SRC} → HTTP ${res.status}`);
const html = await res.text();

const tables = parseTables(html);
const byDir = {};
for (const t of tables) {
  const key = Object.keys(DIR_OF_TABLE).find(k => t.title.startsWith(k));
  if (!key) { console.warn(`알 수 없는 표 건너뜀: ${t.title}`); continue; }
  byDir[DIR_OF_TABLE[key]] = readTable(t);
}
if (!byDir["행사장행"]?.length) throw new Error("하행선(행사장행) 데이터를 읽지 못했습니다 — 원천 페이지 구조 변경 확인 필요");

const srcTs = norm((html.match(/조회일시:\s*([^<]*)/) || [])[1] || "");
const status = { updated: new Date().toISOString(), source: SRC, sourceChecked: srcTs, min: MIN, days: build(byDir, "ko") };
const statusEn = { ...status, days: build(byDir, "en") };

const fs = await import("fs");
fs.writeFileSync("status.json", JSON.stringify(status, null, 1));
fs.writeFileSync("status-en.json", JSON.stringify(statusEn, null, 1));

const nRuns = d => Object.values(d).flatMap(v => Object.values(v)).flatMap(v => Object.values(v)).reduce((a, r) => a + (r.runs?.length || 0), 0);
console.log(`status.json / status-en.json 생성: 하행 ${byDir["행사장행"].length}행, 상행 ${(byDir["귀가행"] || []).length}행, 날짜 ${Object.keys(status.days).length}개, 회차 ${nRuns(status.days)}개 (원천 조회일시 ${srcTs})`);
