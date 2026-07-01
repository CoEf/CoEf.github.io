---
title: "SlotComponent로 인벤토리/장비/상점 통합하기"
date: 2026-06-10
summary: "InventoryComponent, EquipmentComponent, ShopComponent를 하나의 SlotComponent 추상화로 묶은 과정."
tags: ["inventory", "component-architecture"]
project: "farming-inventory-system"
---

세 가지 시스템(인벤토리, 장비, 상점)이 결국 "슬롯에 아이템을 담고, 옮기고,
검증한다"는 동일한 문제를 풀고 있다는 걸 깨닫고 `SlotComponent`로 공통 로직을
추출했습니다.

## 왜 분리했나

각 시스템이 슬롯 개수 제한, 허용 아이템 타입, 스택 규칙 등에서 조금씩 다른
정책을 가지지만 "슬롯 상태를 관리하고 이동 요청을 검증한다"는 뼈대는 동일했습니다.
그래서 `SlotComponent`가 공통 뼈대를 제공하고, 각 상위 컴포넌트가 정책만 주입하는
구조로 정리했습니다.

```gdscript
class_name SlotComponent
extends Node

var slots: Array[ItemStack] = []
var validator: Callable

func can_place(item: ItemData, index: int) -> bool:
    return validator.call(item, index)
```

## 다음 할 일

- `EquipmentComponent`의 슬롯 타입 제약(무기/방어구) 검증기 작성
- `ShopComponent`의 가격 책정 로직을 별도 정책 객체로 분리
