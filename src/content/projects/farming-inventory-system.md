---
title: "농사 게임 인벤토리 · 장비 · 상점 시스템"
summary: "SlotComponent 추상화를 기반으로 한 인벤토리, 장비, 상점 시스템. 드래그앤드롭 UI까지 통합."
status: "in-progress"
stack: ["Godot 4", "GDScript", "Resource"]
role: "1인 개발"
startDate: 2026-04-01
order: 1
---

## 개요

농사 게임의 아이템 관련 시스템 전체를 `SlotComponent`라는 공통 추상화 위에 구성했습니다.
`InventoryComponent`, `EquipmentComponent`, `ShopComponent`가 모두 이 컴포넌트를 감싸는
얇은 래퍼 형태로 동작하며, 각 컨트롤러는 오케스트레이션과 입력 처리만 담당합니다.

## 데이터 / 로직 분리

- `InventoryData` — 상태와 로직을 소유하는 `Resource`
- `Inventory` — 얇은 API를 제공하는 `Node`

스택 병합, 인벤토리 간 아이템 이동, `ResourceSaver` 기반 저장/불러오기를 지원합니다.

## 아이템 데이터 계층

`ItemData`를 부모로 `WeaponItemData`, `ArmorItemData`, `ConsumableItemData`,
`MaterialItemData` 서브클래스를 두었고, `ItemDatabase` 오토로드와 에디터 플러그인
"Item Dock"으로 에셋을 시각적으로 관리합니다.

## 다음 단계

드래그앤드롭 UI 인프라와 인벤토리 UI 테마(다크 미니멀) 작업이 진행 중입니다.
