---
title: "인터랙티브 쉐이더 1편 — 마우스 X좌표로 밝기 조절하기"
date: 2026-07-01
summary: "get_global_mouse_position()을 스크립트에서 읽어 셰이더 유니폼으로 넘기는, 마우스 인터랙션의 가장 기본 패턴."
tags: ["glsl", "2d", "interactive", "mouse"]
category: "shader"
---

![mouse interaction step 1](/images/shader/mouse-1-bcs.gif)

`interactive_shader/mouse` 폴더는 마우스 인터랙션을 6단계로 나눠 실험한 기록입니다. 1편은 가장 기초 — **스크립트가 마우스 상태를 읽고, 셰이더 유니폼에 그대로 꽂아준다**는 패턴 자체를 확인합니다.

## 셰이더

```glsl
shader_type canvas_item;

uniform float brightness = 1.0;
uniform vec3 target_color = vec3(1.0, 0.0, 0.0);

void fragment() {
    vec4 color = texture(TEXTURE, UV);
    color.rgb = mix(color.rgb, target_color, brightness);
    COLOR = color;
}
```

## 스크립트

```gdscript
extends Sprite2D

func _process(delta):
    var mouse_influence = (get_global_mouse_position().x / get_viewport().size.x) + 0.5
    material.set_shader_parameter("brightness", mouse_influence)

    if Input.is_action_just_pressed("ui_accept"):
        material.set_shader_parameter("target_color", Vector3(0.0, 1.0, 0.0))
```

## 원리

셰이더 자체는 인터랙티브한 요소가 전혀 없습니다 — `brightness`만큼 원본 색과 `target_color`를 섞을 뿐인 평범한 `mix()`입니다. **"인터랙티브"는 전적으로 스크립트 쪽 책임**이라는 게 이 예제의 핵심입니다.

- `get_global_mouse_position().x / get_viewport().size.x`로 마우스 X를 0~1로 정규화하고 `+ 0.5`를 더해 0.5~1.5 범위로 만듭니다. `mix()`의 세 번째 인자(weight)가 1을 넘으면 보간이 아니라 외삽(extrapolation)이 되어 `target_color` 쪽으로 더 강하게 밀립니다.
- `Input.is_action_just_pressed("ui_accept")`로 키 입력 시 아예 다른 파라미터(`target_color`)를 바꿔버립니다. 마우스는 연속값을, 키 입력은 이산적인 상태 전환을 맡는 흔한 역할 분담입니다.

이후 2~6편은 전부 이 패턴 — **"매 프레임 입력을 읽어 `set_shader_parameter`로 셰이더에 전달한다"** — 위에 조금씩 복잡한 아이디어(거리 계산, 트레일 누적, SubViewport 피드백)를 얹어가는 구조입니다.
