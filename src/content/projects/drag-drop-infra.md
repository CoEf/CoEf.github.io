---
title: "드래그앤드롭 UI 인프라"
summary: "Mediator 패턴 기반 DragDropManager. SlotUI는 검증 로직 없이 요청만 보내는 구조."
status: "in-progress"
stack: ["Godot 4", "GDScript", "Control"]
role: "1인 개발"
startDate: 2026-05-10
order: 3
---

## 현재 구조 (Mediator 패턴)

- `DragDropManager` — 오토로드, 모든 드래그 요청의 중재자
- `DragPayload` — 타입이 있는 `Resource`
- `SlotUI` — 검증 로직 없이 요청만 전달
- 콜러블 검증기 주입으로 도메인별 규칙 처리
- `DragPreview` — `top_level = true`로 커서를 따라다니는 프리뷰 노드

## 이전 반복

`DragBus` + `DragPayload` + `DragPayloadComponent` + `DropFilterComponent` +
`DragDropController`(Godot `set_drag_forwarding` API 연동) 구조를 먼저 시도했고,
현재의 Mediator 패턴으로 정리했습니다.
