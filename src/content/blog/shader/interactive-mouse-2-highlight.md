---
title: "인터랙티브 쉐이더 2편 — 마우스 근처를 원형으로 밝히기"
date: 2026-07-01
summary: "FRAGCOORD와 스크린스페이스 마우스 좌표 사이의 거리로 원형 하이라이트를 만드는 방법과, 좌표계를 맞추기 위해 Camera2D 변환을 직접 거치는 이유."
tags: ["glsl", "2d", "interactive", "mouse"]
category: "shader"
---

![mouse interaction step 2](/images/shader/mouse-2-highlight.png)

1편이 "값 하나(밝기)"를 마우스로 조절했다면, 2편은 **화면 좌표 간 거리 계산**으로 마우스 근처만 하이라이트합니다.

## 셰이더

```glsl
shader_type canvas_item;

uniform vec2 mouse_position;
uniform float effect_radius = 100.0;

void fragment() {
    vec2 pixel_coord = FRAGCOORD.xy;
    float distance_to_mouse = distance(pixel_coord, mouse_position);

    vec4 original_color = texture(TEXTURE, UV);
    float green_strength = 1.0 - clamp(distance_to_mouse / effect_radius, 0.0, 1.0);

    vec3 final_color = mix(original_color.rgb, vec3(0.0, 1.0, 0.0), green_strength);
    COLOR = vec4(final_color, original_color.a);
}
```

## 스크립트 — 좌표계를 맞추는 부분이 핵심

```gdscript
func _process(delta):
    var mouse_pos = get_global_mouse_position()
    var mouse_viewport = get_viewport().get_camera_2d().get_screen_transform() * mouse_pos
    material.set_shader_parameter("mouse_position", mouse_viewport)
```

## 원리

`FRAGCOORD`는 **화면 픽셀 좌표**(왼쪽 위 기준)인데, `get_global_mouse_position()`은 **월드/게임 좌표**(Camera2D가 이동·줌되어 있으면 화면 좌표와 어긋남)를 반환합니다. 두 좌표계가 다르면 마우스가 있는 곳과 하이라이트가 나타나는 곳이 어긋나 버립니다.

`get_camera_2d().get_screen_transform() * mouse_pos`가 이 문제를 해결합니다 — 월드 좌표를 다시 화면 좌표로 역변환해서 `FRAGCOORD`와 같은 기준으로 맞춰줍니다. **카메라가 원점에 고정된 간단한 테스트에서는 생략해도 티가 안 나지만, 카메라가 조금이라도 움직이면 바로 어긋나는** — 좌표계 문제를 미리 잡아둔 케이스입니다.

(참고: 이 스텝은 촬영 환경에서 자동 마우스 캡처 시 프레임이 갱신되지 않는 현상이 있어 애니메이션 대신 정지 스크린샷으로 남겼습니다. 실제 에디터에서 마우스를 움직이면 초록 원이 정상적으로 따라다닙니다.)
