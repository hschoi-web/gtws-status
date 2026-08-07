// GTWS status.json / status-en.json 생성기 (폴백 스냅샷용)
// 계산 로직은 전부 gtws_build.js 에 있음 — 페이지(index.html)도 같은 파일을 읽어 실시간 계산한다.
//
// 2026-08-07: 페이지가 어드민 리포트를 직접 읽도록 바뀌면서 이 스크립트의 역할이 바뀜.
//   평소 화면은 실시간 계산으로 그려지고, 여기서 굽는 status.json 은
//   **어드민 장애/구조 변경 시 폴백**으로만 쓰인다. (스케줄 1일 2회)
// 실행: node build_status.mjs   → status.json, status-en.json 생성

import { readReport, build, sourceCheckedOf, MIN } from "./gtws_build.js";

const SRC = process.env.GTWS_REPORT_URL || "https://admin.rideus.net/shuttlebus-report/gtws";

const res = await fetch(SRC, { headers: { "User-Agent": "gtws-status-builder" } });
if (!res.ok) throw new Error(`원천 조회 실패: ${SRC} → HTTP ${res.status}`);
const html = await res.text();

const warn = msg => console.warn(`  · ${msg}`);
const byDir = readReport(html, warn);
const srcTs = sourceCheckedOf(html);

const status = { updated: new Date().toISOString(), source: SRC, sourceChecked: srcTs, min: MIN, days: build(byDir, "ko", warn) };
const statusEn = { ...status, days: build(byDir, "en") };

const fs = await import("fs");
fs.writeFileSync("status.json", JSON.stringify(status, null, 1));
fs.writeFileSync("status-en.json", JSON.stringify(statusEn, null, 1));

const nRuns = d => Object.values(d).flatMap(v => Object.values(v)).flatMap(v => Object.values(v)).reduce((a, r) => a + (r.runs?.length || 0), 0);
console.log(`status.json / status-en.json 생성: 하행 ${byDir["행사장행"].length}행, 상행 ${(byDir["귀가행"] || []).length}행, 날짜 ${Object.keys(status.days).length}개, 회차 ${nRuns(status.days)}개 (원천 조회일시 ${srcTs})`);
