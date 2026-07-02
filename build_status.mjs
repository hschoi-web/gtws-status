// GTWS status.json 생성기 — 노션 "GTWS 예약현황"(무주리조트행/귀가행) → status.json
// GitHub Actions에서 매일 실행. 환경변수 NOTION_TOKEN 필요(노션 내부 통합 토큰).
// 노션 통합이 두 DB(페이지)에 공유돼 있어야 함.
// 실행: NOTION_TOKEN=xxx node build_status.mjs   → status.json 생성

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) { console.error("NOTION_TOKEN 환경변수가 필요합니다."); process.exit(1); }

const DS_EVENT = "3566ddd3-3b2e-8118-820a-000b57d8a99c"; // 무주리조트행(행사장행)
const DS_HOME  = "3566ddd3-3b2e-813e-8036-000b922c03bf"; // 귀가행
const H = { "Authorization": `Bearer ${TOKEN}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" };

// 회차 booked = 아래 경유 탑승지 예약 합. 필드명 실측 반영(의정부...6번출구, 공백 없음). 전 노선 min 30.
const ROUTE_MAP = {
  "대전": ["KTX대전역"],
  "무주 터미널": ["무주공용터미널 맞은편 폭포 광장"],
  "천안/세종": ["천안 신세계백화점","세종 BRT환승센터 맞은편"],
  "광주": ["광주 유스퀘어 맞은편"],
  "서울역": ["서울역 13번 출구"],
  "종합운동장역": ["종합운동장역 7번 출구","천호역 7번 출구"],
  "상봉역": ["상봉역 1번 출구"],
  "인천": ["인천국제공항 T2","인천국제공항 T1","원인재역 1번 출구"],
  "고양/김포": ["백석역 2번 출구","김포국제공항 국제선"],
  "의정부": ["의정부역 지하상가 6번출구","별내역 2번 출구"],
  "부산": ["부산역 지하철 4번 출구"],
  "울산/대구": ["울산 태화로터리","대구 콘서트하우스"],
  "강릉/원주": ["KTX강릉역","원주 치악예술관"],
};
const MIN = 30;

async function queryAll(dsId) {
  const rows = []; let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(`https://api.notion.com/v1/data_sources/${dsId}/query`, { method:"POST", headers:H, body:JSON.stringify(body) });
    const j = await r.json();
    if (j.object === "error") throw new Error(`${dsId}: ${j.code} ${j.message}`);
    rows.push(...(j.results||[]));
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return rows;
}
const txt = p => p?.title?.map(x=>x.plain_text).join("") ?? p?.rich_text?.map(x=>x.plain_text).join("") ?? "";
const numOf = p => (p?.type==="number" ? (p.number ?? 0) : (p?.type==="formula" ? (p.formula?.number ?? 0) : 0));
const dateOf = p => p?.date?.start ?? "";

function toRow(page) {
  const P = page.properties || {};
  const rawDay = txt(P["탑승일"]).trim();
  const day = /^\d{4}-\d{2}-\d{2}/.test(rawDay) ? `${+rawDay.slice(5,7)}.${rawDay.slice(8,10)}` : rawDay; // 2026-10-25 → 10.25
  const rawT = txt(P["탑승시간"]).trim();
  const time = /^\d{2}:\d{2}/.test(rawT) ? rawT.slice(0,5) : rawT;                                       // 09:00:00 → 09:00
  const row = { "탑승일": day, "탑승시간": time, "조회일": dateOf(P["조회일"]) };
  for (const cols of Object.values(ROUTE_MAP)) for (const c of cols) row[c] = numOf(P[c]);
  return row;
}
const dayKey = d => { const m = String(d).match(/^(\d+)\.(\d+)/); return m ? (+m[1])*100 + (+m[2]) : 9999; };
// 최신 조회일 행만
function latestOnly(rows) {
  const withDate = rows.filter(r => r["조회일"]);
  if (!withDate.length) return rows; // 조회일 없으면 전체(초기)
  const max = withDate.map(r=>r["조회일"]).sort().at(-1);
  return withDate.filter(r => r["조회일"] === max);
}

function build(eventRows, homeRows) {
  const days = {};
  const add = (rows, dir) => { for (const j of rows) {
    const date = String(j["탑승일"]).trim(), dep = String(j["탑승시간"]).trim();
    if (!date) continue;
    days[date] ??= { "행사장행":{}, "귀가행":{} };
    for (const [route, cols] of Object.entries(ROUTE_MAP)) {
      const booked = cols.reduce((s,c)=> s + (Number(j[c])||0), 0);
      (days[date][dir][route] ??= { stops: cols.join("+"), runs: [] }).runs.push({ dep, booked });
    }
  }};
  add(eventRows, "행사장행"); add(homeRows, "귀가행");
  for (const d in days) for (const dir in days[d]) for (const rt in days[d][dir]) {
    // A안: 예약이 1건이라도 있는 회차만 노출(유령 회차 제거). 다구간 회차 묶음(#2)은 후속(실시간표 반영) 예정.
    const runs = days[d][dir][rt].runs
      .filter(r => r.booked > 0)
      .sort((a,b)=> a.dep.localeCompare(b.dep));
    runs.forEach((r,i)=> r.run = `${i+1}회차`);
    days[d][dir][rt].runs = runs;
  }
  const sorted = {}; Object.keys(days).sort((a,b)=> dayKey(a)-dayKey(b)).forEach(k=> sorted[k]=days[k]);
  return sorted;
}

const [ev, hm] = await Promise.all([queryAll(DS_EVENT), queryAll(DS_HOME)]);
const days = build(latestOnly(ev.map(toRow)), latestOnly(hm.map(toRow)));
const status = { updated: new Date().toISOString(), min: MIN, days };
const fs = await import("fs");
fs.writeFileSync("status.json", JSON.stringify(status, null, 1));
console.log(`status.json 생성: 행사장행 ${ev.length}행, 귀가행 ${hm.length}행, 날짜 ${Object.keys(days).length}개`);
