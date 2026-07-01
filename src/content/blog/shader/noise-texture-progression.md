---
title: "노이즈 텍스처 한 장으로 연기 이펙트까지 — 9단계 진화 기록"
date: 2026-07-01
summary: "노이즈 텍스처를 그대로 출력하는 것부터 시작해서, 채널별 스크롤과 알파 카빙을 거쳐 색이 있는 연기 이펙트가 되기까지의 단계별 실험."
tags: ["glsl", "2d", "noise", "vfx"]
category: "shader"
---

![noise texture progression](/images/shader/noise-texture-2d.gif)

한 씬 안에 스프라이트 9개를 나란히 두고, 노이즈 텍스처 하나를 점점 다듬어 연기 이펙트로 만들어가는 과정을 그대로 남겨봤습니다.

## 1단계 — 그냥 출력

```glsl
void fragment() {
    COLOR = texture(noise_img, UV);
}
```

노이즈 텍스처를 색 보정 없이 그대로 뿌립니다. 무지개색 노이즈가 그대로 보입니다.

## 4단계 — UV 스크롤

```glsl
uniform sampler2D noise_img : repeat_enable;
uniform float speed = 1.0;

void fragment() {
    vec2 uv = vec2(UV.x + TIME * speed, UV.y);
    COLOR.rgb = texture(noise_img, uv).rgb;
}
```

`TIME`으로 UV를 한 방향으로 흘려서 정적인 노이즈에 움직임을 줍니다. `repeat_enable`이 없으면 스크롤하다 텍스처 경계에서 끊깁니다.

## 6단계 — 채널별 다방향 스크롤 + 알파 카빙

```glsl
void fragment() {
    vec2 uv1 = vec2(UV.x + TIME * speed, UV.y);
    vec2 uv2 = vec2(UV.x - TIME * speed, UV.y);
    vec2 uv3 = vec2(UV.x, UV.y + TIME * speed);

    float noise_r = texture(noise_img, uv1).r;
    float noise_g = texture(noise_img, uv2).g;
    float noise_b = texture(noise_img, uv3).b;

    float new_alpha = noise_r * noise_g * noise_b;

    COLOR.rgb = texture(TEXTURE, UV).rgb;               // 원본 스프라이트 색은 유지
    COLOR.a = new_alpha * 10.0 * texture(TEXTURE, UV).a; // 노이즈로 투명도만 깎아낸다
}
```

R/G/B 세 채널을 서로 다른 방향·속도로 스크롤한 뒤 곱하면, 한 방향 스크롤보다 훨씬 불규칙한 패턴이 나옵니다. 이 값을 색이 아니라 **알파(투명도)** 에 쓰는 게 핵심 전환점입니다 — 노이즈가 "모양을 깎아내는 마스크"로 바뀌는 순간입니다. `* 10.0`은 노이즈 값 범위가 좁아서(세 채널 곱이라 값이 작아짐) 눈에 보일 정도로 증폭하는 보정치입니다.

## 9단계 — 색 입히기 + 그라디언트로 위아래 페이드

```glsl
uniform sampler2D noise_img : repeat_enable;
uniform sampler2D gradient_tex : repeat_enable;
uniform float speed = 1.0;
uniform vec3 smoke_color : source_color;

void fragment() {
    vec2 uv1 = vec2(UV.x + TIME * speed, UV.y + TIME * speed * 4.0);
    vec2 uv2 = vec2(UV.x - TIME * speed, UV.y + TIME * speed * 2.0);
    vec2 uv3 = vec2(UV.x,               UV.y + TIME * speed);

    float gradient = texture(gradient_tex, vec2(UV.y, UV.x)).r;
    float noise_r = texture(noise_img, uv1).r;
    float noise_g = texture(noise_img, uv2).g;
    float noise_b = texture(noise_img, uv3).b;
    float new_alpha = noise_r * noise_g * noise_b;

    COLOR.rgb = smoke_color;
    COLOR.a = clamp(new_alpha * 10.0 * gradient, 0.0, 1.0);
}
```

마지막 단계에서 바뀐 건 세 가지입니다.

1. **모든 UV가 위쪽(+Y)으로도 스크롤** — 연기가 위로 피어오르는 느낌 추가 (속도가 채널마다 달라서 뒤틀리며 상승).
2. **임의 색 대신 `smoke_color` 유니폼** — 이제 노이즈는 모양만 담당하고 색은 파라미터로 완전히 분리됩니다 (fire 포스트와 같은 패턴).
3. **1D 그라디언트 텍스처로 전체 알파에 위아래 페이드**를 곱해서, 연기 기둥의 위/아래 끝이 자연스럽게 사라지게 만듭니다.

## 정리

이 진행 과정이 보여주는 건 한 가지입니다 — **같은 노이즈 텍스처라도 "색으로 쓰느냐 vs 알파(마스크)로 쓰느냐"가 이펙트 셰이더의 핵심 갈림길**이라는 것. 색으로 쓰면 그냥 알록달록한 무늬고, 마스크로 쓰는 순간 모양을 만드는 도구가 됩니다.
