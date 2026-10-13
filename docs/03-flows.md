# 03. 사용자 흐름 · 상태 설계

## 1. 거래 전체 흐름

```mermaid
sequenceDiagram
    actor S as 판매자 (앱)
    actor B as 구매자 (앱)
    participant API as 서버
    participant K as 키오스크
    participant E as ESP32 / 보관함

    S->>API: 거래 등록 (물품명, 가격)
    API-->>S: 거래 코드 (예: K7P2QX)
    S-->>B: 거래 코드 전달 (중고거래 채팅 등)
    B->>API: 거래 코드 입력
    API-->>B: 거래 연결 완료 (MATCHED)

    Note over S,E: 맡기기
    S->>API: 맡기기 QR 요청
    API-->>S: QR (5분 유효, 1회용)
    S->>K: QR 보여주기
    K->>API: 스캔 결과 전달
    API-->>K: DROP, 2번 칸
    K->>E: LED 2 BLINK
    K-->>S: "2번 칸에 물건을 넣어주세요" (화면 + 음성)
    E->>K: DOOR 2 OPEN → DOOR 2 CLOSED
    K->>API: 2번 칸 열림 / 닫힘 보고
    API-->>K: 보관 완료 (STORED)
    K->>E: LED 2 ON

    Note over S,E: 찾기
    B->>API: 찾기 QR 요청
    API-->>B: QR
    B->>K: QR 보여주기
    K->>API: 스캔 결과 전달
    API-->>K: PICKUP, 2번 칸
    K->>E: LED 2 BLINK
    K-->>B: "2번 칸에서 물건을 꺼내주세요"
    E->>K: DOOR 2 OPEN → DOOR 2 CLOSED
    K->>API: 2번 칸 열림 / 닫힘 보고
    API-->>K: 수령 완료 (COMPLETED)
    K->>E: LED 2 OFF
```

## 2. 거래(Trade) 상태

```mermaid
stateDiagram-v2
    [*] --> CREATED: 판매자 등록
    CREATED --> MATCHED: 구매자가 코드 입력
    MATCHED --> STORED: 맡기기 완료 (문 닫힘)
    STORED --> COMPLETED: 찾기 완료 (문 닫힘)
    CREATED --> CANCELED: 판매자 취소
    MATCHED --> CANCELED: 판매자/구매자 취소
    STORED --> EXPIRED: 보관 기한(48시간) 초과
    COMPLETED --> [*]
    CANCELED --> [*]
    EXPIRED --> [*]
```

| 상태 | 의미 | 판매자 앱 | 구매자 앱 |
|---|---|---|---|
| CREATED | 등록됨, 구매자 없음 | 거래 코드 표시, 취소 | — |
| MATCHED | 구매자 연결됨 | **맡기기 QR**, 취소 | 보관 대기 중 |
| STORED | 보관함에 있음 | 보관 중 (칸 번호) | **찾기 QR** |
| COMPLETED | 수령 완료 | 완료 | 완료 |
| CANCELED | 취소됨 | | |
| EXPIRED | 기한 초과 | 관리자 문의 안내 | 관리자 문의 안내 |

**규칙**
- 맡기기는 구매자가 연결된(MATCHED) 거래만 가능하다 → 주인 없는 물건이 칸을 차지하지 않게
- STORED 이후에는 앱에서 취소할 수 없다 (물건이 보관함에 있으므로 관리자가 처리)
- 거래 코드는 6자리 영문 대문자+숫자, 헷갈리는 문자(0/O, 1/I) 제외

## 3. 보관함 칸(Locker) 상태

```mermaid
stateDiagram-v2
    [*] --> EMPTY
    EMPTY --> AWAIT_DROP: 맡기기 QR 스캔 (칸 배정)
    AWAIT_DROP --> OCCUPIED: 문 열림 → 닫힘
    AWAIT_DROP --> EMPTY: 60초 동안 문 안 열림 (배정 취소)
    OCCUPIED --> AWAIT_PICKUP: 찾기 QR 스캔
    AWAIT_PICKUP --> EMPTY: 문 열림 → 닫힘
    AWAIT_PICKUP --> OCCUPIED: 60초 동안 문 안 열림 (취소)
```

| 칸 상태 | LED | 의미 |
|---|---|---|
| EMPTY | 꺼짐 | 비어 있음 |
| AWAIT_DROP / AWAIT_PICKUP | **깜빡임** | 지금 열어야 할 칸 |
| OCCUPIED | 켜짐 | 물건 보관 중 |

**칸 배정 규칙**: EMPTY인 칸 중 번호가 가장 작은 칸. 빈 칸이 없으면 키오스크에 "현재 빈 보관함이 없습니다" 안내.

## 4. 문 이벤트 판단 (잠금장치가 없으므로 중요)

| 상황 | 서버 판단 | 결과 |
|---|---|---|
| AWAIT 상태 칸이 열렸다 닫힘 | 정상 | 거래·칸 상태 진행 |
| AWAIT 상태 칸이 열린 채 3분 이상 | 경고 | 키오스크 "문을 닫아주세요" 반복 안내, 관리자 웹 경고 |
| **EMPTY / OCCUPIED 칸이 열림** | **비정상 열림** | 이벤트 `UNEXPECTED_OPEN` 기록, 관리자 웹에 경고 표시, 키오스크 부저 |

→ 잠금장치는 없지만 "누가 언제 어떤 칸을 열었는지"는 전부 기록된다.

## 5. 키오스크 화면 흐름

```mermaid
flowchart TD
    IDLE["대기 화면<br/>QR을 보여주세요"] -->|사람 감지| WELCOME["어서오세요 🔊"]
    WELCOME --> IDLE
    IDLE -->|QR 인식| CHECK["확인 중..."]
    CHECK -->|성공| GUIDE["N번 칸에 넣어주세요 / 꺼내주세요<br/>🔊 + 60초 카운트다운"]
    CHECK -->|실패| ERROR["만료된 QR / 이미 사용된 QR 등<br/>🔊 안내"]
    GUIDE -->|문 닫힘| DONE["보관 완료 / 수령 완료 🔊"]
    GUIDE -->|시간 초과| ERROR
    DONE -->|5초| IDLE
    ERROR -->|5초| IDLE
    IDLE -.->|"로고 5번 탭 + PIN"| ADMIN["관리자 메뉴<br/>기기 키 설정 · 시리얼 상태 · LED 테스트"]
```

## 6. 앱 화면 목록
| 화면 | 내용 |
|---|---|
| 로그인 / 회원가입 | 이메일, 비밀번호, 닉네임 |
| 홈 | 내 거래 목록 (탭: 판매 / 구매), 상태 뱃지 |
| 거래 등록 | 물품명, 가격, 메모 → 완료 시 거래 코드 표시 (복사·공유) |
| 거래 참여 | 거래 코드 입력 |
| 거래 상세 | 상태 타임라인, 칸 번호, **QR 보기** 버튼 (상태에 따라 맡기기/찾기) |
| QR 화면 | QR + 남은 시간 카운트다운, 만료 시 새로 발급 버튼, 화면 밝기 최대 |
| 내 정보 | 닉네임, 로그아웃, 탈퇴 |

## 7. 관리자 웹 화면 목록
| 화면 | 내용 |
|---|---|
| 로그인 | 관리자 계정 |
| 대시보드 | 칸 3개 상태 카드, 오늘 보관/수령 수, 키오스크 연결 상태(마지막 하트비트), 경고 |
| 거래 목록 | 상태 필터, 검색(거래 코드·물품명) |
| 거래 상세 | 판매자·구매자, 상태 타임라인(등록→연결→보관→수령 시각), 사용된 칸 |
| 이벤트 기록 | 문 열림/닫힘, 비정상 열림, 키오스크 접속 기록 |
