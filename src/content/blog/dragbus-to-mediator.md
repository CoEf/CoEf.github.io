---
title: "드래그앤드롭 아키텍처, DragBus에서 Mediator 패턴으로"
date: 2026-06-20
summary: "DragBus + 컴포넌트 조합 구조에서 DragDropManager 중심의 Mediator 패턴으로 리팩터링한 이유."
tags: ["drag-and-drop", "refactor", "ui"]
project: "drag-drop-infra"
---

초기에는 `DragBus`를 중심으로 `DragPayloadComponent`, `DropFilterComponent`를
조합하는 구조를 썼습니다. 유연했지만, 슬롯 UI마다 컴포넌트를 여러 개 붙여야 해서
씬 구성이 무거워졌습니다.

## 문제

- `SlotUI` 하나에 컴포넌트가 3~4개씩 붙음
- 검증 로직이 컴포넌트마다 흩어져서 추적이 어려움
- Godot의 `set_drag_forwarding` API와 커스텀 버스가 이중으로 존재

## 변경

`DragDropManager`(오토로드)를 유일한 중재자로 두고, `SlotUI`는 `DragPayload`를
담아 요청만 보내도록 단순화했습니다. 도메인별 검증은 콜러블로 주입합니다.

```gdscript
DragDropManager.request_drop(payload, target_slot, is_valid_for_equipment)
```

`SlotUI` 자체는 검증 로직을 전혀 모르게 되어 재사용성이 크게 좋아졌습니다.
