# GTWS 셔틀 예약현황 대시보드 — 배포 가이드

노션 "GTWS 예약현황" DB → `status.json` 자동 생성 → GitHub Pages 대시보드.
n8n·별도 서버 없이 **GitHub 하나로** 돌아갑니다.

## 파일
- `index.html` — 대시보드(라이브 모드). `./status.json`을 fetch, 10분마다 갱신. `?demo=1` 붙이면 데모 데이터.
- `status.json` — 예약 집계 결과(달성률 계산용). **이미 오늘자 실데이터로 채워져 있음.**
- `build_status.mjs` — 노션 두 DB(무주리조트행/귀가행)의 **최신 조회일** 행 → status.json 생성.
- `.github/workflows/refresh-status.yml` — 매일 09:05 KST 자동 실행 + 수동 실행 버튼.

## 설치 (5분)
1. **새 repo 생성** (예: `gtws-status`) 후 이 폴더의 파일들을 그대로 올림
   (`.github/workflows/refresh-status.yml` 경로 유지).
2. **Settings > Pages** → Source: `Deploy from a branch`, Branch: `main` / `/(root)` → 저장.
   → `https://<계정>.github.io/gtws-status/` 에 대시보드 표시. 이 주소를 gtws.rideus.net에 링크.
3. **Settings > Secrets and variables > Actions > New repository secret**
   - Name: `NOTION_TOKEN`
   - Value: 노션 내부통합 토큰 (마케팅 자동화에서 쓰던 `ntn_…` 그대로)
4. **노션 공유 확인**: "GTWS 예약현황" 페이지 우측 상단 ⋯ > 연결(Connections) 에 그 통합이 추가돼 있어야 함
   (이미 접근되는 것 확인함 — 안 되면 통합 추가).
5. **Actions 탭 > refresh-status > Run workflow** 로 수동 1회 실행 → status.json 갱신 확인.

이후 매일 09:05(KST) 자동으로 status.json이 갱신·커밋됩니다.

## 참고
- 달성률 = `min(100, round(booked/30*100))`, 전 노선 최소 30명.
- 회차 booked = 그 출발시각의 경유 탑승지 예약 합(ROUTE_MAP, build_status.mjs 참고).
- 현재는 각 노선에 **전체 출발시각이 모두** 표시됩니다(예약 0인 회차 포함). 노선별 실제 운행시각만
  보이게 하려면 예약 0 회차를 숨기는 옵션을 넣을 수 있음(요청 시 반영).
- 실행 주기 단축: yml의 cron + index.html의 setInterval 값 동시 조정.
