---
title: "탑다운 3D RPG 무기 시스템"
summary: "컴포넌트 기반 원거리/근접 무기 시스템. WeaponController가 유일한 오케스트레이터 역할."
status: "completed"
stack: ["Godot 4", "GDScript", "State Machine"]
role: "1인 개발"
startDate: 2026-02-01
order: 2
---

## 아키텍처

`WeaponController`가 모든 무기 관련 컴포넌트를 조율하는 유일한 오케스트레이터입니다.

- `MagazineComponent` — 무기별 탄창 상태
- `AmmoInventoryComponent` — 캐릭터가 보유한 예비 탄약
- `FireComponentBase` → `HitscanFireComponent`, `SpreadFireComponent`
- `WeaponSlotComponent` — 인벤토리 슬롯 연동

## 적 AI와의 연동

9단계 상태 머신 기반 적 AI(지각, 이동, 전투, 체력, 애니메이션 컴포넌트)와
`HealthComponent` + `DamageReactionComponent` 조합으로 피격 반응을 처리합니다.
