---
title: "EditorInspector 대신 커스텀 폼으로: RESOURCE 속성 에디터 다시 만들기"
date: 2026-07-08
summary: "리소스 속성 편집을 EditorInspector 내장 방식에서 우리 스타일에 맞는 커스텀 폼 + 배열 편집기로 교체한 기록."
tags: ["godot-addon", "editor-plugin", "custom-ui"]
category: "devlog"
project: "data-system-addon"
---

무기 전략(`WeaponStrategy`)처럼 리소스 하나를 값으로 갖는 속성이 생기면서,
그 리소스의 세부 필드를 addon을 벗어나지 않고 바로 편집하고 싶었습니다.
처음엔 `EditorInspector`를 서브 인스펙터로 그대로 붙였는데, 두 가지가
계속 걸렸습니다: 우리가 만든 알약 배지/카드 톤과 이질감이 크고,
`Resource Local To Scene`/`Path`/`Name` 같은 내부 필드까지 그대로 노출됐습니다.

## 참고: EditorInspector 없이 만든 사례

오픈소스로 공개된 `godot-resource-database`라는 addon을 살펴봤는데,
`EditorInspector`를 아예 안 쓰고 `get_script_property_list()`로 필드를 읽어
순수 커스텀 컨트롤(SpinBox, CheckBox, LineEdit...)로 직접 그리고 있었습니다.
이 방향이 맞겠다 싶어서 같은 방식으로 갈아엎었습니다.

```gdscript
static func _exported_properties(resource: Resource) -> Array[Dictionary]:
    var script: Script = resource.get_script()
    if script == null:
        return _filter_exported(resource.get_property_list())
    return _filter_exported(_script_properties_base_first(script))
```

인스턴스 기준 `get_property_list()`보다 스크립트 기준 조회가 필드 플래그를
더 안정적으로 잡아준다는 걸 이 과정에서 알게 됐습니다.

<!-- 스크린샷: attack_strategy 카드가 펼쳐져서 hit_size/arc 같은 필드가 보이는 모습 -->
![WeaponStrategy 커스텀 폼](/images/devlog/weapon-strategy-inspector.png)

## 배열로 확장

리소스 하나가 아니라 "여러 개의 참조"(상점 재고, 전리품 테이블)도 같은
틀로 편집하고 싶어서 `RESOURCE_ARRAY`라는 속성 타입을 추가했습니다. 행마다
추가/삭제 버튼을 붙이고, `DataEntity`처럼 속을 펼치면 위험한 타입(엔티티/
그룹/카테고리 자기 자신)은 필드 카드 대신 아이콘+이름만 보여주는 피커로
따로 처리했습니다.

<!-- 스크린샷: 상점 stock 배열 편집 UI (아이콘 + 이름 + 추가/삭제) -->
![stock 배열 편집기](/images/devlog/resource-array-editor.png)

## 다음 할 일

- 배열 안에 배열이 들어가는 경우(현재는 없음)의 UI 검토
