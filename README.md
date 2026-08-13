# 그로미 (GROWME) — 모바일 웹

스마트 화분과 모바일 웹이 연동된 식물 돌봄 서비스.
센서가 식물의 상태를 읽고, 그 상태가 캐릭터의 기분으로 나타난다. 사용자는 기분을 풀어주는 방식으로 식물을 돌본다.

> **화분은 판단하고, 사람은 행동한다.** v2.0에서 급수 펌프가 제거되어 화분은 물을 주지 않는다.
> 대신 사람이 붓는 동안 **실시간으로 "그만!"을 알려주는 급수 가이드**가 대표 기능이다.

기준 문서: `WEB-PRD-v2.0` / 프로토콜 `protoVer 3`

---

## 빠른 시작

```bash
npm install
cp .env.example .env     # 기본값은 mock 모드
npm run dev              # http://localhost:5173

# 다른 터미널에서 (일지·행복도·마지막 상태를 보려면 필요)
npm run server:install
npm run server           # http://localhost:4000/api
```

백엔드는 `DATABASE_URL`이 없으면 **인메모리로 뜬다.** PostgreSQL 없이 바로 실행된다.
Vite 개발 서버가 `/api`를 `localhost:4000`으로 프록시한다.

하드웨어 없이 전 화면을 검수하려면 **`http://localhost:5173/?dev=1`** 로 접속한다.
우측 하단 `DEV` 버튼에서 mood 7종·연결상태 7종·센서 결측·물 붓기를 강제 주입할 수 있다.

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm test` | 유닛 테스트 (파서·단위변환) |
| `npm run lint` | 타입체크만 |

### 환경변수

| 키 | 값 | 설명 |
|---|---|---|
| `VITE_BLE_MODE` | `mock` \| `real` | BLE 클라이언트 전환. 코드 수정 없이 바뀐다 |
| `VITE_API_BASE` | `/api` | 서버 API 기본 경로 |

---

## 실기기(진짜 화분)에 연결하기

시뮬레이터와 실제 Web Bluetooth 구현은 **같은 인터페이스**를 쓴다. 화면 코드는 한 줄도 바뀌지 않는다.

### 1. 모드 전환 — 셋 중 아무거나

| 방법 | 언제 쓰나 |
|---|---|
| 홈 화면의 `실기기로` 버튼 | 가장 간단. 새로고침 후 바로 적용 |
| 주소에 `?ble=real` 추가 | 링크로 공유할 때 |
| `.env`의 `VITE_BLE_MODE=real` | 배포 기본값을 바꿀 때 |

앞의 두 방법은 브라우저에 저장돼 다음 방문에도 유지된다. 되돌리려면 홈에서 `시뮬로`를 누르거나
`?ble=mock`으로 접속한다.

### 2. HTTPS — 대부분 여기서 막힌다

Web Bluetooth는 **보안 컨텍스트(HTTPS 또는 localhost)** 에서만 동작한다.
휴대폰에서 `http://192.168.0.x:5173`으로 열면 `navigator.bluetooth` 자체가 없어 연결 버튼이 죽는다.

```bash
npm run dev:https      # 자체서명 인증서로 HTTPS 기동
```

휴대폰에서 `https://<PC의 LAN IP>:5173` 으로 접속하고, 인증서 경고는 **고급 → 계속**으로 넘어간다.

USB가 편하면 포트 포워딩도 된다. 휴대폰을 USB로 연결하고 PC Chrome에서
`chrome://inspect/#devices` → Port forwarding에 `5173 → localhost:5173`을 등록하면
휴대폰에서 `http://localhost:5173`으로 열 수 있고, localhost는 보안 컨텍스트로 인정된다.

홈 화면의 **연결 진단**이 지금 환경에서 무엇이 막혀 있는지(HTTPS·브라우저·모드) 알려준다.

### 3. 화분 쪽에서 맞춰야 하는 것

| 항목 | 값 |
|---|---|
| 장치명 | `GROWME01` ~ `GROWME99` (접두어 `GROWME`로 검색한다) |
| Service | `0000ffe0-0000-1000-8000-00805f9b34fb` |
| Characteristic | `0000ffe1-...` — Notify(화분→웹) / Write(웹→화분) |
| 첫 패킷 | 부팅 직후 `H,GROWME,3,2.0\n` — protoVer가 3이 아니면 앱이 제어를 잠근다 |
| 센서 패킷 | `D,<soilRaw>,<tempX10>,<humi>,<lightRaw>,<mood>,<seq>\n` 5초 주기 |
| 응답 | 명령 수신 즉시 `A,<cmd>,<result>\n` |

화분이 `A` 응답을 보내지 않으면 앱은 3초 뒤 타임아웃 처리하고 버튼을 다시 풀어준다.

### 4. 하드웨어 없이 실제 경로 검증하기

실기기 코드 경로는 가짜 GATT 스택으로 이미 테스트돼 있다
([WebBleClient.test.ts](src/ble/WebBleClient.test.ts)) — 기기 탐색 필터, 청크 재조립, 20바이트 분할 write,
15초 STALE, 끊김 후 1초·2초·4초 재연결, 오류 분류까지.

```bash
npm test
```

실기기에서 연결이 안 되면 `npm test`부터 돌려서 **웹 문제인지 화분 문제인지** 갈라볼 수 있다.
테스트가 통과하는데 실기기가 안 붙으면 원인은 HTTPS 아니면 화분 펌웨어 쪽이다.

---

iOS는 Web Bluetooth를 지원하지 않아 조회 전용이다.

---

## 구조

```
src/
  ble/          BLE 프로토콜 계층 (§5)
    constants.ts    UUID·명령 생성기·타이밍 상수
    parser.ts       업링크 재조립·파싱 (순수 함수, 유닛테스트 대상)
    BleClient.ts    Web Bluetooth 네이티브 구현 + 20바이트 분할 write
    MockBleClient.ts 시뮬레이터 — 하드웨어보다 먼저 개발하기 위한 장치
    index.ts        환경변수로 실제/Mock 선택
  store/        Zustand — connection / telemetry / pot / character
    bleBridge.ts    BLE ↔ 스토어 배선, 명령 전송 + A 응답 대기
  lib/          convert(단위 변환) · mood(기분 테이블) · format
  data/plants.ts  식물 도감 = S 명령의 유일한 출처 (§11.4)
  api/          fetch 래퍼 + 업로드 큐
  features/     home · water · journal · catalog · shop · character · dev

server/         백엔드 (§12) — Node + Express, TS를 빌드 없이 실행
  src/index.ts      라우트 + 입력 검증
  src/memoryStore.ts / pgStore.ts   저장소 두 구현
  src/gamify.ts     행복도·EXP·레벨 계산 (서버가 계산한다 — §10.3)
  src/schema.sql    PostgreSQL DDL
```

### 서버 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/telemetry` | 센서값 업로드. `(potId, seq, measuredAt)` 중복은 무시 |
| GET | `/api/pots/:potId/latest` | 마지막 상태 (BLE 미연결 시 화면 소스) |
| POST | `/api/pots/:potId/care-logs` | 급수·돌봄 기록 |
| GET | `/api/pots/:potId/care-logs?limit=50` | 일지 타임라인 |
| GET | `/api/pots/:potId/character` | 레벨·EXP·행복도 |
| GET | `/api/plants` | 도감 |
| GET | `/api/health` | 상태 확인 |

PostgreSQL로 붙이려면:

```bash
createdb growme
DATABASE_URL=postgres://localhost/growme npm run server   # 스키마는 기동 시 자동 생성
```

---

## 설계상 반드시 지켜야 하는 것

- **mood는 웹에서 재계산하지 않는다.** 화분이 보내는 값이 유일한 진실이다 (Mock 시뮬레이터만 예외).
- **자동으로 명령을 보내지 않는다.** 연결 직후의 `Q`(프로파일 확인)만 예외다.
- **`W:`(급수) · `N:`(영양) 명령을 전송하지 않는다.** v2.0 하드웨어에 없다.
- **아두이노는 원시값만 보낸다.** 퍼센트 변환·평균 필터는 전부 웹에서 한다.
- **센서 히스토리를 localStorage에 쌓지 않는다.** 서버가 저장한다. (화분 목록·선택만 로컬에 남긴다)
- **실시간 원격 모니터링으로 표현하지 않는다.** BLE는 근거리 전용이고, 외부에서는 마지막 상태 조회만 가능하다.

## 프로토콜 요약 (protoVer 3)

```
Service        0000ffe0-0000-1000-8000-00805f9b34fb
Characteristic 0000ffe1-0000-1000-8000-00805f9b34fb
장치명          GROWME01 ~ GROWME99
```

업링크 `D,<soilRaw>,<tempX10>,<humi>,<lightRaw>,<mood>,<seq>` / `H,GROWME,3,2.0` / `A,<cmd>,<result>`
다운링크 `F:<0|1>` `L:<0-100>` `S:<5개 임계값>` `Q` `R:<0|1>` `P`

`R:1`은 급수 가이드에서만 쓰는 1초 주기 고속 샘플링이며, 화분이 3분 뒤 스스로 해제한다.
웹도 3분 타이머를 두고, 화면을 이탈하면 반드시 `R:0`을 보낸다.

## mood

| mood | 이름 | 앱 표정 |
|---|---|---|
| 0 | OK | 기분 좋음 |
| 1 | THIRSTY | 목마름 |
| 2 | HOT | 더워함 |
| 3 | COLD | 추워함 |
| 4 | DARK | 졸림 |
| 5 | OVERWATER | 배부름·힘듦 |
| 6 | SENSOR_ERR | 상태 확인 불가 |

우선순위 `6 > 2 > 3 > 1 > 5 > 4 > 0` — 화분이 하나만 골라 보낸다.

---

## 진행 상황

| # | 작업 | 상태 |
|---|---|---|
| T-01 | 프로젝트 셋업 | ✅ |
| T-02 | 업링크 재조립·파싱 + 테스트 | ✅ |
| T-03 | MockBleClient + 개발자 패널 | ✅ |
| T-04 | 단위 변환 + 테스트 | ✅ |
| T-05 | 연결 상태 머신 | ✅ |
| T-06 | BleClient 실제 구현 | ✅ |
| T-07 | 홈 대시보드 | ✅ |
| T-08 | 캐릭터·말풍선·솔루션 카드 | ✅ |
| T-09 | 토양수분 목표 대역 게이지 | ✅ |
| T-10 | 급수 가이드 `/water` | ✅ |
| T-11 | 도감 + S/Q 프로파일 동기화 | ✅ |
| T-12 | API 클라이언트 + 업로드 큐 | ✅ |
| T-13 | 오프라인 모드 | ✅ |
| T-14 | QR 딥링크 `/p/:potId` | ✅ |
| T-15 | iOS 조회 전용 모드 | ✅ |
| T-16 | LED 밝기 슬라이더 | ✅ |
| T-17 | EXP·행복도 + 회복 연출 | ✅ |
| T-18 | 일지 탭 | ✅ |

후순위: 다중 화분 전환 UI(최소 형태만 구현됨), 센서 그래프, 상점·인벤토리·퀘스트, 성장 일기 자동 작성
