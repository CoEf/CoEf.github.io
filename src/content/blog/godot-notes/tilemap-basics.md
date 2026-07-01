---
title: "TileMapLayer 기초 정리"
date: 2026-06-25
summary: "Godot 4.3부터 TileMap을 대체한 TileMapLayer의 기본 사용법과 자주 헷갈리는 좌표 변환."
tags: ["tilemap", "reference"]
category: "godot-notes"
---

Godot 4.3부터 `TileMap`이 `TileMapLayer`로 대체됐습니다. 레이어 하나당 노드
하나를 두는 방식으로 바뀌면서 레이어 관리가 더 명시적으로 바뀌었습니다.

## 좌표 변환

- `local_to_map(local_position)` — 월드/로컬 좌표 → 셀 좌표
- `map_to_local(cell_coords)` — 셀 좌표 → 로컬 좌표 (셀 중심 기준)

```gdscript
var cell := tile_map_layer.local_to_map(global_position)
var world_pos := tile_map_layer.map_to_local(cell)
```

## 자주 하는 실수

`map_to_local()`은 **셀의 중심**을 반환합니다. 셀의 좌상단이 필요하면
`tile_set.tile_size`의 절반만큼 빼야 합니다.

## 런타임 타일 설정

```gdscript
tile_map_layer.set_cell(Vector2i(3, 2), source_id, atlas_coords)
```

`erase_cell(coords)`로 제거, `get_cell_source_id(coords)`로 현재 타일 확인이
가능합니다.
