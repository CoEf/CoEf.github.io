---
title: "VisualShader로 2D 불 이펙트 만들기 — 텍스처 4장 합성"
date: 2026-07-01
summary: "Add/Multiply/Subtract 텍스처를 순서대로 합성하고 1D 그라디언트로 색을 입히는 방식으로 불 이펙트를 만든 기록."
tags: ["glsl", "2d", "visualshader", "vfx"]
category: "shader"
---

![fire](/images/shader/fire-2d.gif)

Godot의 VisualShader 그래프로 만든 2D 불 이펙트입니다. 노드 그래프가 생성한 GLSL을 뽑아보면 핵심 로직이 드러납니다.

## 핵심 코드 (VisualShader가 생성한 GLSL)

```glsl
shader_type canvas_item;
render_mode blend_mix;

uniform vec2 Scale = vec2(1.0, 1.0);
uniform vec2 Speed = vec2(0.0, 1.0);
uniform sampler2D Texture_Main : source_color, repeat_enable;
uniform sampler2D Texture_Add : source_color;
uniform sampler2D Texture_Multiply : source_color;
uniform sampler2D Texture_Subtract : source_color;
uniform sampler2D Texture_Color_1D : source_color;

void fragment() {
    vec2 scaled_uv = UV * Scale;
    vec2 scrolled_uv = scaled_uv + TIME * Speed;

    float main_r = texture(Texture_Main, scrolled_uv).r;
    float add_r = texture(Texture_Add, UV).r;
    float mul_r = texture(Texture_Multiply, UV).r;
    float sub_r = texture(Texture_Subtract, UV).r;

    float mask = clamp((main_r + add_r) * mul_r - sub_r, 0.0, 1.0);
    vec4 final_color = texture(Texture_Color_1D, vec2(mask));

    COLOR.rgb = final_color.rgb;
    COLOR.a = final_color.a;
}
```

(원본은 VisualShader 노드 그래프라 연산 순서가 `n_out24 = (main+add) * mul` 식으로 조금 다르지만, 의미상 위와 동일합니다.)

## 원리

1. **Texture_Main**을 `TIME * Speed`로 스크롤해서 노이즈가 위로 흐르는 것처럼 보이게 만듭니다.
2. Add/Multiply/Subtract 텍스처 3장을 R채널만 뽑아 `(main + add) * mul - sub` 순서로 합성합니다 — 포토샵 레이어 블렌드 모드를 셰이더 안에서 재현한 것과 같습니다.
3. 결과를 `clamp(0,1)`한 값을 **1D 그라디언트 텍스처**의 좌표로 사용합니다. 즉 "얼마나 불투명한가"라는 스칼라 값 하나를 검정→주황→흰색 그라디언트에 매핑해서 실제 불꽃 색으로 바꾸는 방식입니다.

이 구조의 장점은 **모양(마스크)과 색(그라디언트)이 완전히 분리**된다는 점입니다. 그라디언트 텍스처만 바꾸면 같은 마스크로 파란 불꽃, 초록 독가스 등으로 재활용할 수 있습니다.

## 캡처하며 발견한 점

테스트 씬의 스프라이트가 `T_1_pixel.jpg`(1x1 텍스처)를 베이스로 쓰고 스케일만 41.75배로 키운 형태라, 실제 화면에서는 아이콘 크기로 작게 렌더링됩니다. 위 GIF는 그 부분만 크롭해서 확대한 것입니다.
