# 05. API 명세

- 기본 경로: `https://<배포도메인>/api`
- 요청·응답: JSON, 시간은 ISO 8601 (UTC)
- 인증: 사용자 `Authorization: Bearer <jwt>` / 관리자 세션 쿠키 / 키오스크 `X-Kiosk-Key: <key>`

## 공통 에러 형식

```json
{ "error": { "code": "QR_EXPIRED", "message": "만료된 QR입니다." } }
```

| HTTP | code 예시 | 상황 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 요청 값 오류 |
| 401 | `UNAUTHORIZED` | 토큰·쿠키·기기 키 없음 또는 잘못됨 |
| 403 | `FORBIDDEN` | 권한 없음 (예: 남의 거래) |
| 404 | `NOT_FOUND` | |
| 409 | `INVALID_STATE` / `NO_EMPTY_LOCKER` / `QR_USED` | 상태상 불가능 |
| 410 | `QR_EXPIRED` | QR 만료 |

---

## 1. 사용자 인증 (앱)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/signup` | 회원가입 → JWT 반환 |
| POST | `/auth/login` | 로그인 (`role=USER`만) → JWT 반환 |
| GET | `/me` | 내 정보 |
| DELETE | `/me` | 회원 탈퇴 (진행 중 거래가 있으면 409) |

```http
POST /api/auth/signup
{ "email": "boram@example.com", "password": "********", "nickname": "보람" }

200 OK
{ "token": "eyJ...", "user": { "id": "ck...", "email": "boram@example.com", "nickname": "보람" } }
```

## 2. 거래 (앱)

| 메서드 | 경로 | 설명 | 가능한 사람 |
|---|---|---|---|
| POST | `/trades` | 거래 등록 → 거래 코드 발급 | 로그인 사용자 |
| GET | `/trades?role=seller\|buyer` | 내 거래 목록 | 본인 |
| GET | `/trades/:id` | 거래 상세 | 판매자·구매자 |
| POST | `/trades/join` | 거래 코드로 구매자 참여 | 판매자 본인 제외 |
| POST | `/trades/:id/cancel` | 취소 (CREATED, MATCHED만) | 판매자·구매자 |
| POST | `/trades/:id/qr` | QR 발급 (판매자: 맡기기, 구매자: 찾기) | 판매자·구매자 |

```http
POST /api/trades
{ "itemName": "에어팟 프로 2세대", "price": 150000, "memo": "미개봉" }

201 Created
{ "id": "ck...", "code": "K7P2QX", "status": "CREATED" }
```

```http
POST /api/trades/join
{ "code": "K7P2QX" }

200 OK
{ "id": "ck...", "status": "MATCHED" }
```

```http
POST /api/trades/ck.../qr

200 OK
{ "qr": "pickbox://qr/3q2+7w...", "purpose": "DROP", "expiresAt": "2026-10-13T05:05:00Z" }
```
- 판매자 + `MATCHED` → `DROP`, 구매자 + `STORED` → `PICKUP`, 그 외는 409
- 새로 발급하면 같은 거래의 이전 미사용 QR은 무효화

## 3. 키오스크

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/kiosk/heartbeat` | 1분마다 생존 신호. 응답으로 칸 상태 전체 (LED 동기화용) |
| POST | `/kiosk/scan` | QR 스캔 결과 전달 → 칸 배정 |
| POST | `/kiosk/lockers/:number/door` | 문 열림/닫힘 보고 |

```http
POST /api/kiosk/scan
X-Kiosk-Key: ****
{ "qr": "pickbox://qr/3q2+7w..." }

200 OK
{
  "action": "DROP",
  "lockerNumber": 2,
  "awaitUntil": "2026-10-13T05:01:00Z",
  "itemName": "에어팟 프로 2세대",
  "message": "2번 보관함에 물건을 넣어주세요"
}
```
에러 예: `QR_EXPIRED`, `QR_USED`, `NO_EMPTY_LOCKER`, `INVALID_STATE` → 키오스크는 `message`를 화면·음성으로 그대로 안내

```http
POST /api/kiosk/lockers/2/door
X-Kiosk-Key: ****
{ "state": "CLOSED" }

200 OK
{
  "result": "STORED",           // STORED | PICKED_UP | NONE | UNEXPECTED
  "lockerNumber": 2,
  "led": "ON",                  // 키오스크가 ESP32에 보낼 LED 상태
  "message": "보관이 완료되었습니다"
}
```

```http
POST /api/kiosk/heartbeat
X-Kiosk-Key: ****
{ "appVersion": "0.1.0", "serialConnected": true }

200 OK
{ "lockers": [ { "number": 1, "status": "EMPTY", "led": "OFF" },
               { "number": 2, "status": "OCCUPIED", "led": "ON" },
               { "number": 3, "status": "AWAIT_DROP", "led": "BLINK" } ] }
```

**서버의 시간 초과 처리**: `awaitUntil`이 지난 AWAIT 칸은 다음 요청(스캔·문 보고·하트비트) 때 서버가 먼저 정리한다 (`ASSIGN_TIMEOUT` 기록). MVP에서는 별도 스케줄러 없이 이 방식으로 충분하다.

## 4. 관리자 (웹)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/admin/login` | 로그인 (`role=ADMIN`만) → 세션 쿠키 |
| POST | `/admin/logout` | 로그아웃 |
| GET | `/admin/dashboard` | 칸 상태, 오늘 통계, 키오스크 상태, 경고 |
| GET | `/admin/trades?status=&q=&page=` | 거래 목록 |
| GET | `/admin/trades/:id` | 거래 상세 + 이벤트 타임라인 |
| GET | `/admin/events?lockerId=&type=&page=` | 이벤트 기록 |

관리자 웹 페이지는 Server Component에서 DB를 직접 조회해도 되지만, **API 경계를 연습하기 위해 위 API를 통해 조회하는 것을 원칙**으로 한다.

## 5. QR 형식
```
pickbox://qr/<token>
```
- `<token>`: 서버가 만든 **랜덤 32바이트(base64url)**. 의미 있는 정보(거래 ID 등)를 담지 않는다.
- 서버는 `SHA-256(token)`만 저장 → 스캔 시 해시로 조회
- **5분 유효, 1회용**. 스캔 성공 즉시 `usedAt` 기록
- 스킴(`pickbox://`)이 다르면 키오스크가 서버에 보내지 않고 "PickBox QR이 아닙니다" 안내
