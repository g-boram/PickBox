# PickBox

> 중고거래 직거래 부담을 줄여주는 **무인 물품 보관소**
> 판매자는 보관함에 맡기고, 구매자는 QR 하나로 찾아간다.

웹(Next.js) · 앱(Flutter) · 키오스크(Kotlin) · 펌웨어(ESP32)를 직접 설계·개발·배포하는 개인 프로젝트입니다.

## 왜 만들었나
- 중고거래는 늘었지만 **직거래는 시간 맞추기와 낯선 사람을 만나는 부담**이 크다
- 고가 물품은 택배 거래 시 **분실·파손 위험**이 있다
- → 판매자가 원하는 시간에 맡기고, 구매자가 원하는 시간에 찾아가는 무인 보관소

## 구성
| 폴더 | 역할 | 기술 | 사용자 |
|---|---|---|---|
| [`web/`](web/) | 관리자 사이트 + API 서버 | Next.js, TypeScript, Prisma, PostgreSQL | 관리자 |
| [`app/`](app/) | 거래 등록·QR 발급 앱 | Flutter (Android / iOS) | 사용자 |
| [`kiosk/`](kiosk/) | 보관소 키오스크 (태블릿) | Kotlin, Jetpack Compose, CameraX | 현장 |
| [`firmware/`](firmware/) | 보관함 LED·문 센서·인체감지 제어 | ESP32 (Arduino, C++) | 기기 |
| [`docs/`](docs/) | 설계 문서 | | |

## 설계 문서
1. [기획 · MVP 범위](docs/01-overview.md)
2. [시스템 구조 · 기술 스택 · 배포](docs/02-architecture.md)
3. [사용자 흐름 · 상태 설계](docs/03-flows.md)
4. [데이터베이스](docs/04-database.md)
5. [API 명세](docs/05-api.md)
6. [키오스크 · 하드웨어 · 시리얼 프로토콜](docs/06-kiosk-hardware.md)
7. [개발 로드맵](docs/07-roadmap.md)

## 진행 상황
- [x] 0단계 · 설계 (2026-10-13)
- [ ] 1단계 · 백엔드 + 관리자 웹
- [ ] 2단계 · 키오스크 (Kotlin)
- [ ] 3단계 · 펌웨어 + 보관함 제작
- [ ] 4단계 · 사용자 앱 (Flutter) + 스토어 배포
- [ ] 5단계 · 확장
