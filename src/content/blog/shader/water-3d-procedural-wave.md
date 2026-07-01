---
title: "절차적 파도 쉐이더 — 버텍스에서 물결을 계산하고 노멀도 직접 구하기"
date: 2026-07-01
summary: "sin/abs 조합의 wave 함수를 4개 겹쳐 높이를 만들고, 인접 샘플과의 차분으로 노멀을 근사하는 물 쉐이더."
tags: ["glsl", "3d", "water", "procedural"]
category: "shader"
---

![water](/images/shader/water-3d.gif)

텍스처 노멀맵 없이, **버텍스 셰이더 안에서 파도 높이와 노멀을 동시에 계산**하는 방식입니다.

## 핵심 코드

```glsl
shader_type spatial;
render_mode specular_toon;

uniform sampler2D noise;
uniform sampler2D normalmap;
uniform float wave_speed = 0.25;

float wave(vec2 position) {
    position += texture(noise, position / 10.0).x * 2.0 - 1.0;
    vec2 wv = 1.0 - abs(sin(position));
    return pow(1.0 - pow(wv.x * wv.y, 0.65), 4.0);
}

float height(vec2 position, float time) {
    float d  = wave((position + time * wave_speed) * 0.4) * 0.3;
    d += wave((position - time * wave_speed) * 0.3) * 0.3;
    d += wave((position + time * wave_speed) * 0.5) * 0.2;
    d += wave((position - time * wave_speed) * 0.6) * 0.2;
    return d;
}

void vertex() {
    vec2 pos = VERTEX.xz;
    float k = height(pos, TIME);
    VERTEX.y = k;
    NORMAL = normalize(vec3(
        k - height(pos + vec2(0.1, 0.0), TIME),
        0.1,
        k - height(pos + vec2(0.0, 0.1), TIME)
    ));
}

void fragment() {
    float fresnel = sqrt(1.0 - dot(NORMAL, VIEW));
    RIM = 0.2;
    ROUGHNESS = 0.01 * (1.0 - fresnel);
    ALBEDO = vec3(0.01, 0.03, 0.05) + (0.05 * fresnel);
}
```

## 원리

**`wave()` 함수**는 `1.0 - abs(sin(x))`를 x/y 양쪽에 적용해 뾰족한 물마루(cusp) 모양을 만들고, 여기에 노이즈 텍스처로 좌표를 살짝 흔들어 완전히 규칙적인 격자무늬가 되는 걸 막습니다. `pow(..., 4.0)`은 마루를 더 뾰족하게 깎아 파도 크레스트 느낌을 강조합니다.

**`height()`는 이 wave를 서로 다른 위상/속도로 4겹 합성**합니다 — 진폭(0.3, 0.3, 0.2, 0.2)과 속도(0.4~0.6)를 다르게 줘서, 큰 너울과 잔물결이 겹친 것처럼 보이게 하는 흔한 파도 합성 기법입니다.

**노멀은 노멀맵 텍스처 없이 유한 차분(finite difference)으로 근사**합니다. 현재 위치의 높이와 x/z로 살짝 이동한 위치의 높이를 비교해서 기울기를 구하고, 그 기울기를 노멀 벡터로 변환합니다. 별도의 노멀맵을 굽지 않고도 버텍스 애니메이션과 노멀이 항상 일치한다는 게 장점입니다.

**프래그먼트는 아주 어두운 심해색**(`vec3(0.01, 0.03, 0.05)`)에 프레넬 항만 살짝 더해서, 정면에서는 거의 검게, 스치는 각도에서는 하얗게 반짝이는 모습을 만듭니다.

## 캡처 중 발견한 점

`height_scale`이라는 uniform이 선언은 되어 있지만 `height()` 계산에서 실제로 곱해지지 않아, 인스펙터에서 값을 바꿔도 파도 높이가 변하지 않습니다. 진폭은 `wave()` 호출부에 하드코딩된 0.3/0.3/0.2/0.2가 그대로 적용됩니다 — 파라미터를 노출했지만 실제 계산에 연결이 안 된 흔한 실수 케이스라 기록해 둡니다.
