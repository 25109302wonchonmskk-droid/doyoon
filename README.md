# doyoon score

축구 경기 일정과 결과를 보여주는 한국어 웹사이트입니다.

## 기능

- 프리미어리그, 라리가, 분데스리가, 세리에 A, 리그 1, 챔피언스리그
- 한국 시간(Asia/Seoul) 기준 날짜 선택과 경기 일정/결과
- 30초 자동 갱신, 수동 새로고침, 진행/종료/예정 상태 필터
- 팀 이름 검색, 경기 즐겨찾기, 경기 상세 및 ESPN 원문 연결
- 데스크톱과 모바일 반응형 화면

## 데이터

Vercel Function `/api/scores?date=YYYY-MM-DD`가 ESPN scoreboard의 공개 JSON 응답을 가져옵니다. 인증 키는 사용하지 않습니다. 축구 엔드포인트에서 날짜 범위 요청이 실패하는 것을 확인했으므로, 지정일과 전날을 개별 요청하고 경기 시작 시각을 한국 날짜로 변환해 필터링합니다. 성공 응답은 Vercel CDN에서 15초 캐시하고, 화면은 30초마다 조회합니다. 숨겨진 탭의 자동 조회는 중지합니다. 따라서 점수는 순간 전송이 아니며 제공처의 지연과 캐시 주기가 반영됩니다.

시작 전에는 제공처의 0점 초기값을 스코어로 표시하지 않습니다. 연기/취소/중단은 별도 상태입니다. 일부 리그가 실패하면 해당 리그를 명시하고, 전체 연결 실패는 502 오류로 표시합니다. 실패를 경기 없음으로 처리하지 않습니다. 즐겨찾기는 브라우저 localStorage에 저장하며, 로그인 및 기기 간 동기화는 없습니다.

지원 데이터 피드에는 가용성 보장이 없습니다. 데이터 제공 중단이나 형식 변경 시 연결 코드를 수정해야 합니다. K리그 및 다른 대회는 현재 제공 범위에 포함되지 않습니다.

## 구성과 배포

- `index.html`, `styles.css`, `app.js`: 화면과 클라이언트 기능
- `football.mjs`: 리그 목록, 한국 날짜, 스코어 정규화
- `api/scores.js`: Vercel Node.js 24 서버 함수
- `vercel.json`: 함수 최대 30초와 응답 헤더
- `tests/football.test.mjs`: 날짜 경계, 상태, 스코어, 오류 처리 테스트

빌드 및 외부 npm 의존성이 없는 정적 프론트엔드 + 서버 함수 구성입니다. 기존 Vercel 프로젝트 doyoon의 GitHub main 브랜치에 배포합니다.

검사: `npm test` 및 `node --check app.js`.
11개 자동 검사를 통과했고 실제 ESPN 연결에서 6개 리그의 응답 및 한국 날짜로 정규화된 경기 목록을 확인했습니다. 제작 환경의 미리보기 도구 제약으로 실제 브라우저 화면 검증은 수행하지 못했습니다.

참고:
- https://www.espn.com/soccer/scoreboard
- https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard
- https://vercel.com/docs/functions/runtimes/node-js
