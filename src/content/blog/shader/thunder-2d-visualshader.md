---
title: "번개(Thunder) 이펙트 — 스크롤 텍스처 + Vanishing Value"
date: 2026-07-01
summary: "Line2D에 텍스처를 스크롤시키고 smoothstep으로 사라지는 정도를 조절하는 번개 셰이더."
tags: ["glsl", "2d", "visualshader", "vfx"]
category: "shader"
---

![thunder](/images/shader/thunder-2d.gif)

`Line2D`(지그재그 번개 선)에 입힌 셰이더로, `AnimationPlayer`가 `Vanishing_Value`를 0.3 → 1.0으로 애니메이션시키면서 번개가 번쩍이고 사라지는 것처럼 보이게 합니다.

## 핵심 코드 (VisualShader가 생성한 GLSL)

```glsl
shader_type canvas_item;
render_mode blend_add, unshaded;

uniform float Vanishing_Value : hint_range(0.0, 1.0);
uniform vec2 Speed = vec2(-2.0, 0.0);
uniform sampler2D basic_texture : source_color, repeat_enable;

void fragment() {
    vec2 scrolled_uv = UV + TIME * Speed;
    float tex_r = texture(basic_texture, scrolled_uv).r;

    float mask = smoothstep(Vanishing_Value, 1.0, tex_r);
    COLOR.rgb = COLOR.rgb * mask;
}
```

## 원리

- **`render_mode blend_add, unshaded`**: 가산 블렌딩이라 겹칠수록 밝아지고, unshaded라 조명 영향을 받지 않습니다 — 번개 특유의 "그 자체로 빛나는" 느낌에 맞습니다.
- **텍스처 스크롤**: `Speed = (-2, 0)`으로 UV를 왼쪽으로 흘려서 번개 안에 전류가 흐르는 듯한 텍스처 애니메이션을 만듭니다.
- **`smoothstep(Vanishing_Value, 1.0, tex_r)`**: `Vanishing_Value`가 임계값 역할을 합니다. 값이 0에 가까우면 텍스처의 어두운 부분까지 다 살아남아 번개가 진하게 보이고, 1에 가까우면 가장 밝은 부분만 남아 거의 사라진 것처럼 보입니다. `AnimationPlayer`가 이 값을 0.3(진하게) → 1.0(소멸)으로 움직이면서 번개가 번쩍하고 잦아드는 효과를 만듭니다.
- **`COLOR.rgb * mask`**: 원본 `Line2D`의 `default_color`(황금빛)에 마스크를 곱해서 최종 밝기를 결정 — 셰이더 자체는 색을 만들지 않고 노드에 지정된 색을 변조만 합니다.

씬에는 `Thunder`(Line2D) 외에 스파크 파티클(`sparks`), 플레어 파티클(`Flare`), `PointLight2D`가 같은 `AnimationPlayer`로 타이밍이 맞춰져 있어서, 번개 줄기 + 착지 지점 스파크 + 화면 조명이 한 번에 트리거됩니다.
