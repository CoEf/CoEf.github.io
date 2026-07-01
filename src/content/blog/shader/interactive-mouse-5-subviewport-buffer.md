---
title: "인터랙티브 쉐이더 5편 — SubViewport로 진짜 트레일 버퍼 만들기 (진행 중)"
date: 2026-07-01
summary: "3~4편의 한계(정적 텍스처)를 넘어서기 위해 SubViewport를 자기 참조 텍스처로 쓰는 인프라를 준비한 단계. PermanentTrail.gdshader는 작성됐지만 아직 씬에 연결되지 않은 상태."
tags: ["glsl", "2d", "interactive", "mouse", "subviewport"]
category: "shader"
---

![mouse interaction step 5](/images/shader/mouse-5-subviewport.gif)

이번 편은 완성된 이펙트가 아니라 **진행 중인 인프라 구축 단계**를 그대로 기록한 것입니다. 정직하게 남겨둡니다 — 실제로 개발이 이렇게 단계적으로, 미완성 상태를 거쳐 진행되기 때문입니다.

## 지금까지 만들어진 부분: 마우스를 따라가는 스탬프

```gdscript
extends Sprite2D

func _process(delta: float) -> void:
    global_position = get_global_mouse_position()
```

`SubViewport` 안에 이 스크립트가 붙은 스프라이트(`hole.png`)를 두고, 바깥의 `SubViewportContainer`로 그 렌더링 결과를 화면에 보여줍니다. 이 자체는 아직 "트레일"이 아니라 **그냥 마우스를 따라다니는 도장(stamp) 하나**입니다.

## 준비돼 있지만 아직 연결 안 된 셰이더

```glsl
// PermanentTrail.gdshader
shader_type canvas_item;

uniform sampler2D permanent_trail_map;
uniform vec2 mouse_uv;
uniform float brush_size = 0.01;
uniform vec3 trail_color = vec3(0.0, 1.0, 0.0);

void fragment() {
    vec4 trail_data = texture(permanent_trail_map, UV);
    float trail_strength = trail_data.g;

    if (distance(UV, mouse_uv) < brush_size) {
        trail_strength = 1.0;
    }

    vec3 final_color = mix(texture(TEXTURE, UV).rgb, trail_color, trail_strength);
    COLOR = vec4(final_color, texture(TEXTURE, UV).a);
}
```

3~4편과 달리 **감쇠(decay)가 아예 없습니다** — 한 번 칠해진 자리는 영구적으로 남는다는 뜻이고, 이름 그대로 `PermanentTrail`입니다. `permanent_trail_map`이라는 이름에서 의도가 드러납니다: **이 텍스처는 매 프레임 자기 자신에게 그려 넣는 SubViewport의 출력이어야 합니다.**

## 남은 연결고리

지금 씬에는 이 셰이더가 실제로 붙어있지 않습니다. 남은 작업은:

1. `SubViewport`의 렌더링 결과(`sub_viewport.get_texture()`)를 **그 SubViewport 자신의 다음 프레임 입력**으로 되먹임(feedback loop)
2. 그 피드백 텍스처를 `permanent_trail_map` 유니폼에 연결
3. 마우스를 따라가는 스탬프가 매 프레임 그 버퍼 위에 찍히면서 자연스럽게 "지나간 자리가 남는" 트레일이 완성

이 3단계가 마무리되면 6편에서 쓰인 것과 같은 구조(SubViewport 자기참조 텍스처)가 됩니다. 실제로 6편은 이 인프라를 3D 지형에 적용해 완성한 버전입니다.
