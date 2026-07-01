---
title: "3D 아웃라인 쉐이더 3가지 비교 — 버텍스 확장 vs 스텐실 vs 소벨 엣지"
date: 2026-07-01
summary: "같은 테스트 씬에 노멀 확장, 스텐실 버퍼, 스크린스페이스 소벨 엣지 검출 3가지 아웃라인 기법을 나란히 붙여본 기록."
tags: ["glsl", "3d", "outline", "post-processing"]
category: "shader"
---

![outline comparison](/images/shader/outline-3d.gif)

아웃라인을 그리는 방법은 접근 축이 완전히 다른 3갈래로 나뉩니다. 한 씬에 세 가지를 다 붙여서 비교했습니다.

## 1. 버텍스 확장 (backface expansion)

가장 고전적인 방법. 모델을 살짝 부풀린 복제본을 만들고 **앞면을 컬링(`cull_front`)해서 뒷면만** 그리면, 원본 메시 바깥으로 삐져나온 부분이 테두리처럼 보입니다.

```glsl
// outline_used_size.gdshader — 버텍스를 통째로 스케일
shader_type spatial;
render_mode blend_mix, cull_front, unshaded;

uniform vec4 color : source_color = vec4(1, 0, 0, 1);
uniform float size : hint_range(1.0, 1.5, 0.01) = 1.05;

void vertex() {
    VERTEX *= size;
}

void fragment() {
    ALBEDO = color.rgb;
    ALPHA = color.a;
}
```

```glsl
// outline.res(VisualShader)가 생성한 코드 — 노멀 방향으로 밀어내는 버전
void vertex() {
    VERTEX = VERTEX + NORMAL * FloatParameter; // thickness
}
```

`VERTEX *= size`(스케일)와 `VERTEX += NORMAL * thickness`(노멀 확장)는 같은 목적이지만 결과가 다릅니다. 스케일은 원점 기준으로 커지기 때문에 두께가 부위마다 달라질 수 있고, 노멀 확장은 표면에 수직으로 균일하게 두꺼워집니다.

## 2. 스텐실 버퍼

Godot 4.3부터 `StandardMaterial3D`에 `stencil_mode` / `stencil_flags` / `stencil_compare`가 추가되면서, **커스텀 셰이더 코드 없이 머티리얼 설정만으로** 스텐실 기반 아웃라인을 만들 수 있습니다.

```gdscript
# 1st pass: 스텐실에 실루엣을 "쓰기"
material.stencil_mode = STENCIL_MODE_WRITE   # stencil_mode = 1
material.stencil_flags = STENCIL_FLAG_XXX    # stencil_flags = 2

# 2nd pass(next_pass): 스텐실 값이 다른 곳만 확대 렌더링
outline_material.stencil_mode = STENCIL_MODE_COMPARE  # stencil_mode = 3
outline_material.grow = true
outline_material.grow_amount = 0.03
```

원리는 버텍스 확장과 비슷하지만(실루엣을 부풀려서 그린다), **GPU 스텐실 테스트로 "원본이 그려지지 않은 픽셀만" 걸러낸다**는 점이 다릅니다. 그 결과 별도의 `cull_front` 트릭 없이도 깔끔한 윤곽선을 얻을 수 있고, `next_pass` 체인으로 셰이더와 조합도 가능합니다(테스트 씬에서는 스텐실 + `outline.res`/`outline_used_size` 셰이더를 함께 next_pass로 묶어 쓰기도 합니다).

## 3. 스크린스페이스 소벨 엣지 검출

앞의 두 방법은 **오브젝트 단위**로 적용해야 하지만, 이 방법은 **화면 전체에 한 번**만 적용합니다.

```glsl
shader_type spatial;

uniform sampler2D SCREEN_TEXTURE: hint_screen_texture, filter_linear;
uniform sampler2D NORMAL_TEXTURE: hint_normal_roughness_texture, filter_linear;
uniform float outline_threshold = 0.2;
uniform vec3 outline_color: source_color;

bool is_edge(vec2 uv, vec3 normal, vec2 offset) {
    // 8방향 이웃 픽셀의 노멀을 가져와 현재 노멀과의 거리(length) 계산
    // → 소벨 커널(sobel_x, sobel_y)로 미분해서 급격한 변화(edge) 검출
    ...
    float edge = sqrt(pow(edge_x, 2.0) + pow(edge_y, 2.0));
    return edge > outline_threshold;
}

void fragment() {
    vec3 screen_normal = texture(NORMAL_TEXTURE, SCREEN_UV).rgb * 2.0 - 1.0;
    if (is_edge(SCREEN_UV, screen_normal, 1.0 / VIEWPORT_SIZE)) {
        ALBEDO = outline_color;
    } else {
        ALBEDO = texture(SCREEN_TEXTURE, SCREEN_UV).rgb;
    }
}
```

`hint_normal_roughness_texture`로 전체 화면의 노멀 버퍼를 가져온 다음, 소벨 커널로 인접 픽셀 간 노멀 변화율을 계산합니다. 노멀이 급격히 꺾이는 지점(실루엣 경계, 뾰족한 모서리)이 곧 엣지로 판정됩니다.

## 언제 뭘 쓸까

| 방법 | 장점 | 단점 |
|---|---|---|
| 버텍스 확장 | 구현 단순, 오브젝트별 색/두께 제어 쉬움 | 뾰족한 모서리에서 갈라짐(normal 불연속) |
| 스텐실 버퍼 | 셰이더 코드 없이 재사용, next_pass로 조합 자유 | Godot 4.3+ 필요, 파이프라인 이해 필요 |
| 소벨 엣지 | 화면 전체 일괄 적용, 오브젝트 수와 무관 | 카메라 각도/거리에 따라 두께가 변함, threshold 튜닝 필요 |
