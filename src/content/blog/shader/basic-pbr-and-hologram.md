---
title: "기본 PBR 텍스처링 + 홀로그램 쉐이더 3종"
date: 2026-07-01
summary: "Albedo/Roughness/NormalMap을 textureLod로 채우는 기본 PBR 구조와, 프레넬+스캔라인+ProximityFade로 만드는 홀로그램 효과."
tags: ["glsl", "3d", "pbr", "hologram", "visualshader"]
category: "shader"
---

![basic pbr and hologram](/images/shader/basic-hologram-3d.gif)

같은 씬에 있는 구체 3개 — 기본 PBR 텍스처링, 하이트맵 변위가 추가된 버전, 그리고 홀로그램 — 를 비교했습니다. 셋 다 VisualShader로 만들어져 있어, 생성된 GLSL을 기준으로 정리합니다.

## 기본 PBR (basic1) — textureLod로 밉맵 레벨 직접 제어

```glsl
shader_type spatial;

uniform float Lod : hint_range(0.0, 10.0, 1.0) = 0.0;
uniform sampler2D Albedo : source_color, repeat_enable;
uniform sampler2D Roughness : repeat_enable;
uniform float RoughnessPower : hint_range(0.0, 1.0);
uniform sampler2D NormalMap : hint_normal, repeat_enable;
uniform float NormalMapPower = 1.0;

void fragment() {
    vec4 albedo_tex = textureLod(Albedo, UV, Lod);
    float roughness_tex = textureLod(Roughness, UV, Lod).r;

    ALBEDO = albedo_tex.rgb;
    ROUGHNESS = roughness_tex * RoughnessPower;
    NORMAL_MAP = textureLod(NormalMap, UV, Lod).rgb;
    NORMAL_MAP_DEPTH = NormalMapPower;
}
```

일반 `texture()` 대신 `textureLod()`를 써서 **밉맵 레벨을 파라미터로 직접 노출**한 게 특징입니다. 인스펙터에서 `Lod` 슬라이더를 움직이면 텍스처 선명도를 강제로 낮춰볼 수 있어서, 거리별 밉맵 전환이 어떻게 보이는지 확인하는 용도로 유용합니다.

## 변위 버전 (basic2) — 버텍스에서 Heightmap 밀어내기

```glsl
void vertex() {
    float height = texture(Heightmap, UV).r;
    VERTEX = fma(NORMAL, vec3(DisplacementValue * height), VERTEX); // VERTEX + NORMAL * (DisplacementValue * height)
}
```

프래그먼트 로직은 basic1과 동일하고, 버텍스 단계에서만 `Heightmap` 텍스처 밝기만큼 노멀 방향으로 표면을 밀어냅니다. Rock 텍스처 세트에 포함된 `Rock_Height.png`를 그대로 활용해 굴곡을 더한 버전입니다.

## 홀로그램 — 프레넬 + 스캔라인 + ProximityFade

```glsl
void fragment() {
    // 스캔라인: 월드 Y좌표를 sin()에 태워 위아래로 흐르는 줄무늬
    vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
    float scan = sin(Scanline_WIdth * world_pos.y - TIME * Scanline_speed);
    float scan_mix = Scanline_CenterWeigh * ((scan + 1.0) / 2.0);

    // 프레넬: 표면이 시야와 수직에 가까울수록 강해짐
    float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), Fresnel_Pawor);

    // ProximityFade: 다른 오브젝트와 겹치는 부분을 부드럽게 페이드 (깊이 버퍼 비교)
    float proximity = compute_proximity_fade(depth_tex_frg_16, Proximity_Highlight);

    float alpha = scan_mix + mix(fresnel + (1.0 - proximity), fresnel + (1.0 - proximity), 0.5);
    float alpha2 = compute_proximity_fade(depth_tex_frg_25, Proximity_Fade_Alpha);

    ALBEDO = ColorParameter.rgb;
    ALPHA = alpha * alpha2;
    EMISSION = mix(vec3(0.0), ColorParameter.rgb * Emission_Brightness, alpha * alpha2);
}
```

(VisualShader가 실제로 생성하는 코드는 `n_out14p0`, `n_out27p0`처럼 노드 번호가 붙은 중간 변수로 가득해서, 위 코드는 같은 로직을 알아보기 쉽게 재구성한 것입니다. `compute_proximity_fade`도 실제로는 `ProximityFade` 노드가 인라인으로 펼쳐놓은 블록입니다.)

세 가지 재료가 겹쳐서 홀로그램 특유의 "반투명하게 떠 있는 빛 덩어리" 느낌을 만듭니다.

1. **스캔라인**: 월드 Y좌표(`INV_VIEW_MATRIX * VERTEX`로 뷰 공간→월드 공간 역변환)를 `sin()`에 넣고 `TIME`으로 흘려서, 화면이 아니라 오브젝트 표면에 고정된 스캔라인이 위로 흐르게 합니다.
2. **프레넬**: 표면이 카메라 시선과 나란할수록(가장자리) 밝아지는 고전적인 홀로그램 테두리 효과.
3. **ProximityFade가 두 번**: 깊이 텍스처를 두 번 샘플링해서, 다른 지오메트리(바닥, 캐릭터 등)와 겹치는 지점의 알파를 부드럽게 줄입니다. 하나는 `Proximity_Highlight`(겹치는 경계를 밝게 강조), 다른 하나는 `Proximity_Fade_Alpha`(겹치는 부분을 아예 투명하게)로 서로 다른 용도로 쓰입니다.
4. 마지막에 **`EMISSION`을 알파에 비례해서 키워서**, 진해지는 부분일수록 더 밝게 빛나 보이게 만듭니다 — `ALPHA`와 `EMISSION`이 같은 변수(`alpha * alpha2`)를 공유해서 "빛이 강한 곳 = 잘 보이는 곳"이 항상 일치합니다.
