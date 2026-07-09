---
title: "Data System 에디터: 아이콘과 검색으로 그룹/엔티티 구분하기"
date: 2026-07-06
summary: "그룹/엔티티에 아이콘을 달고, 그룹·카테고리 이름으로도 하위 엔티티까지 검색되게 트리 필터를 손본 기록."
tags: ["godot-addon", "editor-plugin", "ux"]
category: "devlog"
project: "data-system-addon"
---

엔티티 수가 늘어나면서 트리에서 텍스트 라벨만으로는 뭐가 뭔지 한눈에 구분이
안 되기 시작했습니다. 아이콘을 붙이고, 검색도 이름만 걸리던 걸 그룹/카테고리
단위로 넓혔습니다.

## 아이콘

`DataGroup`/`DataEntity`에 `icon: Texture2D` 필드를 추가하고, 트리에서 지정한
아이콘을 그대로 쓰되 없으면 기본 폴더/오브젝트 아이콘으로 폴백하게 했습니다.

<!-- 스크린샷: Data 탭 트리에서 그룹/엔티티마다 아이콘이 보이는 모습 -->
![그룹/엔티티 아이콘](/images/devlog/data-system-tree-icons.png)

## 검색 범위 넓히기

기존엔 이름/ID만 걸렸는데, 그룹 이름으로 검색하면 그 안의 엔티티가 하나도 안
걸려도 결과에 다 나오게 하고 싶었습니다. 매치된 그룹 아래로는 강제 표시
플래그를 전파하는 방식으로 풀었습니다.

```gdscript
func _filter_item(item: TreeItem, query: String, force_show: bool) -> bool:
    var res: Resource = item.get_metadata(0)
    var self_matched := query.is_empty() or force_show or _item_matches_query(item, res, query)
    var child_force := force_show or (self_matched and res is DataGroup)
    var any_child := false
    var child := item.get_first_child()
    while child:
        if _filter_item(child, query, child_force):
            any_child = true
        child = child.get_next()
    item.visible = self_matched or any_child
    return item.visible
```

카테고리 이름 검색은 별도 전파 로직 없이 자연스럽게 풀렸습니다.
`entity.get_all_categories()`가 이미 그룹 상속분까지 포함해서 반환하기 때문에,
`_item_matches_query`에서 이 목록을 훑는 것만으로 상속받은 카테고리까지 검색
대상이 됩니다.

## 카테고리/속성도 정리

부착된 카테고리를 알약(pill) 배지로 바꿔서 직접 부착과 상속을 색으로
구분하고, 속성들은 카테고리별로 카드(왼쪽에 카테고리 색 라인)로 묶었습니다.

<!-- 스크린샷: 카테고리 배지 + 속성 카드가 보이는 인스펙터 -->
![카테고리 배지와 속성 카드](/images/devlog/data-system-category-badges.png)

## 다음 할 일

- RESOURCE 타입 속성(무기 전략 등)을 지금보다 더 잘 보여주는 방법 고민
