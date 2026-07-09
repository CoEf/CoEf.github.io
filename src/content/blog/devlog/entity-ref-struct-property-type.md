---
title: "카테고리 속성의 문자열 DSL을 ENTITY_REF/STRUCT 타입으로 걷어내기"
date: 2026-07-09
summary: "\"아이템id:개수:확률\" 같은 문자열 DSL로 채우던 카테고리 속성을, 엔티티 참조 피커와 구조체 배열 에디터로 교체한 기록."
tags: ["godot-addon", "editor-plugin", "data-design"]
category: "devlog"
project: "data-system-addon"
---

Data System addon의 카테고리 속성 중 상당수가 문자열 하나에 여러 값을 욱여넣는
DSL 이었습니다. `equipment.stat_bonus`는 `"strength:1"`, `dungeon.reward_loot`는
`"아이템id:개수:확률, ..."` 식으로요. 콜론 하나만 빠뜨려도 조용히 깨지고,
에디터에서는 그냥 텍스트필드라 뭐가 들어가는지 알 수가 없었습니다. 이번에
`ENTITY_REF`, `STRUCT`라는 두 속성 타입을 새로 만들어서 이 DSL들을 걷어냈습니다.

## 문제: 왜 문자열 DSL이 아팠나

정리해보니 12개 속성이 전부 이 패턴이었습니다.

| 속성 | 실제 형태 |
|---|---|
| `shop.stock`, `npc.liked_items` | `id, id, ...` |
| `recipe.ingredients`, `buildable.build_cost`, `quest_reward.reward_items`, `dungeon.enemies` | `id:count, ...` |
| `loot.loot_table`, `dungeon.reward_loot`, `trap.loot_table`, `harvestable.loot_table` | `id:count:chance, ...` |
| `equipment.stat_bonus` | `stat:amount, ...` (엔티티 참조가 아니라 enum+float) |
| `dungeon.boss_id` | 단일 id |
| `quest.objectives` | `kill dummy 5` 같은 줄 단위 DSL |

`enemy.gd`, `harvest_node.gd`, `trapped_chest.gd`, `dungeon_system.gd` 네 군데에
`split(",")` → `split(":")` 파싱 루프가 거의 그대로 복붙돼 있었고, 에디터에서는
이 텍스트필드가 어떤 아이템을 가리키는지 확인할 방법이 없었습니다.

## 방향: 문자열 ID 참조 + 카테고리 필터 피커

엔티티가 엔티티를 참조하게 만들려면 `Array[DataEntity]` 같은 실제 Resource
참조도 가능하지만, 런타임 전체가 이미 `GameDB.get_entity(StringName)` 패턴으로
동작하고 있어서 여기서도 문자열 ID 참조가 일관성 있었습니다. 대신 에디터에서는
ID만 타이핑하는 게 아니라 아이콘+이름이 보이는 검색 피커로 골라야 합니다.

```gdscript
enum PropertyType {
    BOOL, INT, FLOAT, STRING, TEXT, VECTOR2, VECTOR3, COLOR, ENUM, RESOURCE,
    ## 다른 DataEntity 를 문자열 ID(StringName)로 참조.
    ENTITY_REF,
    ## 여러 필드를 묶은 구조체. struct_fields 가 요소 스키마를 정의.
    STRUCT,
}
```

`entity_ref_category`로 피커가 보여줄 대상을 좁힙니다. 마침 `DataCategory`가
이미 `"item"`, `"enemy"`, `"boss"`처럼 태그 역할을 하고 있어서, 던전의
`enemies`는 `category="enemy"`로, 상점 `stock`은 `category="item"`으로
필터링하면 됩니다. `DataDatabase.get_entities_with_category()`를 그대로
재사용했습니다.

<!-- 스크린샷: ENTITY_REF 스칼라 속성 버튼(아이콘+이름)을 눌러 검색 팝업이 뜬 모습.
     팝업 안에 검색창, 필터된 ItemList, 하단에 "id 직접 입력" 필드, "선택 해제" 버튼이 보이면 됨. -->
![엔티티 참조 검색 피커](/images/devlog/entity-ref-picker.png)

## 배열만으론 부족했다: STRUCT 타입

처음엔 `is_array` 플래그만 있으면 될 줄 알았는데, `id:count:chance`처럼
튜플이 필요한 케이스가 훨씬 많았습니다. `stat_bonus`는 아예 엔티티 참조가
아니라 `enum + float`였고요. 그래서 `struct_fields: Array[DataPropertyDef]`로
요소 하나의 스키마를 재귀적으로 정의하게 했습니다.

```gdscript
## type 이 STRUCT 일 때 요소를 구성하는 필드 정의 목록.
@export var struct_fields: Array[DataPropertyDef] = []

## struct_fields 의 기본값으로 채운 요소 Dictionary 하나를 만든다.
func make_struct_element() -> Dictionary:
    var element: Dictionary = {}
    for field: DataPropertyDef in struct_fields:
        if field and not field.property_name.is_empty():
            element[field.property_name] = field.get_default()
    return element
```

`loot_table`은 `STRUCT{ id: ENTITY_REF(item), count: INT, chance: FLOAT }` +
`is_array=true`로, `stat_bonus`는 `STRUCT{ stat: ENUM, amount: FLOAT }` +
`is_array=true`로 정의됩니다. 값 자체는 `Array[Dictionary]`라서 별도 파서 없이
그대로 순회할 수 있습니다.

에디터 쪽 배열 에디터는 필드마다 열을 하나씩 배치해서 표처럼 보이게
그렸습니다. 인덱스 캡처는 클로저 대신 `.bind()`로 처리해서(이 addon의 다른
곳에서도 이미 쓰던 패턴) 반복문 변수 캡처 버그를 피했습니다.

```gdscript
static func _rebuild_struct_array(box: VBoxContainer, def: DataPropertyDef, values: Array, on_changed: Callable) -> void:
    for i in values.size():
        var row := HBoxContainer.new()
        var element: Dictionary = values[i]
        for field: DataPropertyDef in def.struct_fields:
            var editor := create(field, element.get(field.property_name, field.get_default()),
                    _on_struct_element_field_changed.bind(element, field.property_name, values, on_changed))
            row.add_child(editor)
        var remove_btn := Button.new()
        remove_btn.pressed.connect(_on_struct_element_removed.bind(box, def, values, on_changed, i))
        row.add_child(remove_btn)
        box.add_child(row)
```

<!-- 스크린샷: slime_king 같은 몹의 loot_table 인스펙터. 헤더 행에 id/count/chance,
     그 아래로 요소마다 [아이템 피커 버튼 | count 스핀박스 | chance 스핀박스 | X] 행,
     맨 아래 "+ 추가" 버튼. -->
![loot_table STRUCT 배열 편집기](/images/devlog/loot-table-struct-editor.png)

카테고리 정의 화면에서도 STRUCT 속성이면 필드를 추가/삭제/이름변경/타입변경할
수 있게 만들었습니다. 다만 필드 타입에 STRUCT/RESOURCE는 허용하지 않았는데,
중첩을 한 단계로 막아서 에디터 코드가 재귀적으로 복잡해지는 걸 피하기
위해서입니다.

<!-- 스크린샷: 카테고리 편집 화면에서 loot_table 속성을 STRUCT 타입으로 선택하고,
     그 아래 "구조체 필드" 섹션에 id(ENTITY_REF)/count(INT)/chance(FLOAT) 행이
     나열되고 "+ 필드 추가" 버튼이 보이는 모습. -->
![STRUCT 필드 정의 UI](/images/devlog/struct-field-definition.png)

퀘스트 목표(`objectives`)의 `target`은 까다로웠습니다. `kill dummy 5`처럼
`dummy`가 정식 엔티티가 아니라 하드코딩된 월드 대상인 경우가 있어서, 피커
팝업에 "id 직접 입력" 줄을 하나 추가해서 엔티티 목록에 없는 이름도 타이핑해서
넣을 수 있게 열어뒀습니다.

## 런타임 정리: 파서 하나로 합치기

값이 `Array[Dictionary]`가 되면서 각 시스템에 흩어져 있던 `split` 파싱
루프가 다 걷혔습니다. 드롭 테이블 처리는 `LootEntry`라는 작은 헬퍼로
새로 뽑았습니다.

```gdscript
class_name LootEntry
extends RefCounted

static func from_value(value: Variant) -> Array[LootEntry]:
    var result: Array[LootEntry] = []
    if value is Array:
        for element: Variant in value:
            if not element is Dictionary:
                continue
            var dict := element as Dictionary
            var entry := LootEntry.new()
            entry.entity_id = StringName(str(dict.get("id", "")))
            entry.count = maxi(1, int(dict.get("count", 1)))
            entry.chance = clampf(float(dict.get("chance", 1.0)), 0.0, 1.0)
            result.append(entry)
    elif value is String:
        # 옛 "id:count:chance, ..." 문자열도 그대로 지원 (하위호환)
        ...
    return result

## 확률 굴림까지 통과한 항목만 반환.
static func roll(value: Variant) -> Array[LootEntry]:
    var result: Array[LootEntry] = []
    for entry: LootEntry in from_value(value):
        if randf() <= entry.chance:
            result.append(entry)
    return result
```

덕분에 `enemy.gd`의 드롭 처리는 이렇게 세 줄로 줄었습니다.

```gdscript
for entry: LootEntry in LootEntry.roll(entity.get_value("loot_table")):
    var toss := Vector2.RIGHT.rotated(randf() * TAU) * randf_range(60.0, 120.0)
    scene.call("spawn_world_item", entry.entity_id, entry.count, global_position, toss, 0.4)
```

`ItemRequirement`, `QuestObjective`에도 각각 `from_value()`를 추가해서 새
Array 형식과 옛 문자열 형식을 둘 다 받게 했습니다. 다시 문자열로 되돌아갈
일은 없지만, 마이그레이션 스크립트를 못 돌린 데이터가 남아 있어도 게임이
안 깨지게 하려는 안전장치입니다.

## 데이터 마이그레이션

카테고리 정의(9개 `.tres`)는 필드 스키마를 새로 짜야 해서 수동으로
고쳤고, 엔티티 값(43개 `.tres`)은 정규식 기반 스크립트로 일괄 변환했습니다.

```
# before
"stat_bonus": "strength:1",
"loot_table": "kings_crown:1:1.0, mega_potion:2:0.8, slime_gel:3:1.0",

# after
"stat_bonus": [{ "amount": 1.0, "stat": "strength" }],
"loot_table": [{ "chance": 1.0, "count": 1, "id": &"kings_crown" }, { "chance": 0.8, "count": 2, "id": &"mega_potion" }, { "chance": 1.0, "count": 3, "id": &"slime_gel" }],
```

## 다음 할 일

- `game/data/create_*.gd` 시드 스크립트들이 아직 옛 문자열 포맷을 생성함 —
  재실행할 일이 생기면 같이 손봐야 함
- STRUCT 필드 안에 ENTITY_REF 배열처럼 "필드 자체가 배열인 경우"는 아직
  지원 안 함 (지금까지는 필요한 케이스가 없었음)
