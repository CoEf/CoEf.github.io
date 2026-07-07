---
title: "Data System — 리소스 기반 데이터 관리 애드온"
summary: "그룹 트리 + 카테고리(컴포넌트) 구조로 게임 데이터를 관리하는 Godot 4.7 에디터 플러그인. 전용 에디터 탭과 GameDB 정적 조회 API 제공."
status: "completed"
stack: ["Godot 4.7", "GDScript", "EditorPlugin", "Resource"]
role: "1인 개발"
startDate: 2026-07-05
order: 4
# links:
#   repo: "https://github.com/사용자명/레포-이름"
---

## 개요

아이템·장비·퀘스트·캐릭터 스탯처럼 종류는 다르지만 다루는 방식이 비슷한 정적
데이터를 하나의 시스템으로 관리하기 위한 Godot 에디터 플러그인입니다. "그룹 트리 +
카테고리(컴포넌트)" 구조로 데이터를 조립하고, 전용 에디터 탭에서 관리하며,
런타임에서는 `GameDB` 정적 API로 조회합니다.

## 데이터 모델

- `DataEntity` — 데이터 한 건 (철검, 포션, 퀘스트 하나, 캐릭터 스탯...)
- `DataGroup` — 트리 폴더. `Item/Equip/Sword`처럼 중첩되며, 그룹에 카테고리를
  붙이면 하위 전체가 상속받음
- `DataCategory` — 컴포넌트 역할. 속성 정의(이름/타입/기본값) + `CategoryLogic`를
  상속한 로직 스크립트를 묶음
- `DataDatabase` — 그룹 트리 + 카테고리 목록 전체, id/이름 인덱스 구축

값 해석 우선순위는 **엔티티가 덮어쓴 값 → 카테고리 기본값** 순이고, 엔티티 하나에
카테고리를 여러 개(예: `equipment` + `consumable`) 부착할 수 있습니다.

## 에디터 플러그인

메인 화면에 "Data" 탭을 추가해 트리 / 카테고리 목록 / 인스펙터를 제공합니다.
드래그 앤 드롭으로 그룹 이동, 더블클릭 이름 변경, 타입별 속성 편집 컨트롤
(BOOL부터 RESOURCE까지 10종)을 지원합니다. 저장 시 `.tres` 파일을
`database.tres`(그룹 트리) + `categories/*.tres` + `entities/*.tres`로 분리해
git 히스토리에서 변경 사항을 추적하기 쉽게 했습니다.

## 런타임 API

```gdscript
var sword := GameDB.get_entity(&"iron_sword")
var weapons := GameDB.get_entities_in_group("Item/Equip")
sword.call_category("equipment", "use", [player])
```

오토로드 등록 없이 정적 클래스(`GameDB`)로 어디서든 호출할 수 있습니다. 카테고리에
`CategoryLogic`을 상속한 스크립트를 연결하면 `use()`, `get_dps()` 같은 함수를
데이터 쪽에 바인딩할 수 있어, 아이템별 분기 로직을 게임 코드에 흩뿌리지 않고
데이터 정의와 함께 둘 수 있습니다.

## 검증

애드온만 따로 두고 끝내지 않고, 이 애드온으로 아이템·퀘스트·던전·건설·NPC 호감도까지
갖춘 탑다운 액션 RPG 데모를 직접 만들어 API가 실제 게임 로직에서 무리 없이
맞물리는지 확인했습니다.
