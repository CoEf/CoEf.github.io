---
title: "무기 공격 로직에 Strategy 패턴 적용하기"
date: 2026-07-07
summary: "player.gd의 weapon_type 분기문을 WeaponStrategy 리소스로 걷어낸 리팩터링 기록."
tags: ["design-pattern", "refactor", "gdscript"]
category: "devlog"
project: "data-system-demo"
---

무기 종류가 검/창/망치/총/유도탄/유탄/레이저/파동탄까지 늘어나면서
`Player._try_attack()`의 `match weapon_type:` 분기가 감당이 안 될 정도로
커졌습니다. 무기 하나 추가할 때마다 이 함수를 계속 건드려야 하는 게 문제였습니다.

## 설계

`WeaponStrategy`(Resource) 베이스 클래스를 두고, 근접/투사체/유탄/레이저
계열별로 서브클래스(`MeleeStrategy`, `ProjectileStrategy`, `GrenadeStrategy`,
`LaserStrategy`)를 만들었습니다. "이 무기를 어떻게 쏘고 휘두를지"는 전략이
정하고, "그걸 실제로 어떻게 그릴지"(트윈, 판정 Area2D 등)는 `Player`가 계속
담당하도록 역할을 나눴습니다.

```gdscript
func fire(player: Player, weapon: DataEntity) -> void:
    player.start_melee_swing(
            weapon, hit_size, hit_offset, swing_time, arc, thrust,
            WeaponStrategy.weapon_damage(weapon),
            knockback,
            WeaponStrategy.weapon_effect(weapon))
```

`weapon` 카테고리에 `attack_strategy`(RESOURCE) 속성을 추가해서 무기 엔티티마다
전략 리소스를 매달았고, `_try_attack()`은 이제 한 줄입니다.

```gdscript
weapon.get_value("attack_strategy").fire(self, weapon)
```

<!-- 스크린샷: Data 탭에서 weapon 엔티티의 attack_strategy 에 전략 리소스가 물려 있는 모습 -->
![attack_strategy 지정 화면](/images/devlog/weapon-strategy-inspector.png)

## 같은 계열인데 수치가 다른 경우

권총과 소총은 둘 다 `weapon_type = "gun"`이지만 발사 속도가 다릅니다
(900 vs 1400). 하나의 공용 전략 리소스를 공유하면 이 차이를 표현할 수
없어서, `gun_pistol.tres` / `gun_rifle.tres`로 전용 인스턴스를 따로
만들어 배정했습니다. "같은 종류"와 "같은 리소스를 공유"는 다른 문제라는 걸
다시 확인한 지점이었습니다.

## 다음 할 일

- 전략 리소스의 세부 수치를 에디터에서 더 편하게 들여다볼 방법
