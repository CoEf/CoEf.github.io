---
title: "인벤토리 저장/불러오기: Resource 기반 직렬화"
date: 2026-06-30
summary: "InventoryData를 Resource로 두고 ResourceSaver로 저장/로드를 구현한 기록."
tags: ["save-load", "inventory"]
category: "devlog"
project: "farming-inventory-system"
---

`InventoryData`를 `Resource`로 설계해두면 `ResourceSaver.save()` /
`ResourceLoader.load()`만으로 저장과 불러오기가 거의 공짜로 딸려옵니다.

## 구조

- `InventoryData` (Resource) — 슬롯 배열, 스택 병합 로직, 전송 검증을 소유
- `Inventory` (Node) — `InventoryData`를 감싸는 얇은 API. 신호 발신 담당

```gdscript
func save_to_disk(path: String) -> void:
    ResourceSaver.save(data, path)

func load_from_disk(path: String) -> void:
    data = ResourceLoader.load(path) as InventoryData
```

## 주의할 점

`Resource`를 씬에서 직접 참조하면 인스턴스가 공유되는 문제가 생길 수 있어서,
로드 시점에 `duplicate(true)`로 깊은 복사를 해주는 게 안전했습니다.
