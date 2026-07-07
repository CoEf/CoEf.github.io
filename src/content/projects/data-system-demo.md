---
title: "Data System 데모 — 탑다운 액션 RPG"
summary: "Data System 애드온으로 아이템·퀘스트·던전·건설·호감도까지 구현한 탑다운 2D 액션 RPG 데모."
status: "completed"
stack: ["Godot 4.7", "GDScript", "Resource", "Autoload"]
role: "1인 개발"
startDate: 2026-07-06
order: 5
# links:
#   repo: "https://github.com/사용자명/레포-이름"
---

## 개요

"Data System" 애드온을 실제 게임에서 검증하기 위해 만든 탑다운 2D 액션 RPG
데모입니다. 카테고리 18종을 조합해 아이템·몬스터·퀘스트·던전·NPC·건설물 등
70여 개의 엔티티를 데이터로 정의하고, 7개의 오토로드 시스템이 `GameDB`를 통해
그 데이터를 읽어 동작합니다.

## 시스템 구성

- `Items` — 인벤토리 / 핫바 / 장비 / 드래그 커서 / 상점 / 골드
- `Quests` — `LOCKED → AVAILABLE → ACTIVE → READY → COMPLETED` 진행 상태 관리
- `Stats` — 기본 스탯 + 장비 보너스 + 버프 합산, 파생 공식(체력/공격력/이속)
- `Builds` — 32px 그리드 기반 기지 건설 배치/철거
- `Dungeons` — 웨이브 전투 아레나(보스 포함), 아레나를 동적으로 생성
- `Affinity` — 선물 / 대화 / 퀘스트로 오르는 NPC 호감도 → 상점 할인
- `Saves` — `user://` 하위 JSON 파일로 저장/불러오기

각 시스템은 플레이 중 변하는 진행 상태만 들고 있고, 정의(스탯 수치, 조합법,
웨이브 구성 등)는 전부 애드온의 `GameDB`에서 읽어옵니다 — 게임 로직과 데이터가
완전히 분리된 구조입니다.

## 데이터 카테고리

```
buildable, consumable, crop, dungeon, enemy, equipment, harvestable,
item, loot, npc, quest, quest_reward, recipe, shop, stats, tool, trap, weapon
```

18종의 카테고리 조합으로 무기·방어구·몬스터·퀘스트·NPC·레시피·건설물을 표현합니다.
초기 데이터는 손으로 하나씩 만들지 않고 `create_*.gd` 스크립트(아이템/무기/퀘스트/
던전/농장/보스/월드 등)가 코드로 생성해 채워 넣습니다.

## 사용한 애드온

이 데모는 자체 제작한 "Data System" 애드온 위에서 동작합니다. 애드온 쪽은
포트폴리오의 별도 항목("Data System — 리소스 기반 데이터 관리 애드온")으로
정리했습니다.
