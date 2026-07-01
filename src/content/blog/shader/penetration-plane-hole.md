---
title: "관통 단면(Penetration) 이펙트 — 평면과의 거리로 discard하기"
date: 2026-07-01
summary: "임의의 3D 직선(평면)과 표면의 거리를 계산해 그 안쪽을 discard하고, 경계에 EMISSION 글로우를 입히는 관통 이펙트."
tags: ["glsl", "3d", "discard", "vfx"]
category: "shader"
---

![penetration effect](/images/shader/penetration-3d.gif)

칼이나 창이 오브젝트를 관통한 자리에 구멍이 뚫린 것처럼 보이게 하는 이펙트입니다. 별도 지오메트리 잘라내기 없이 프래그먼트 셰이더의 `discard` 하나로 처리합니다.

## 핵심 코드

```glsl
shader_type spatial;
render_mode cull_disabled;

uniform float hole_radius = 0.05;

varying vec3 frag_pos;

void vertex() {
    frag_pos = VERTEX;
}

void fragment() {
    vec3 start_point = vec3(0.0, 0.1, 10.0);
    vec3 end_point   = vec3(0.0, 0.1, -10.0);
    float pulse = 0.5 * (cos(TIME * 5.0) + 1.0) * hole_radius;

    vec3 dir = start_point - end_point;
    float d_plane = -dot(frag_pos, dir);
    float param = (dot(start_point, dir) + d_plane) / dot(dir, dir);
    vec3 closest = start_point - dir * param;
    float dist = distance(frag_pos, closest);

    if (dist < hole_radius) {
        discard;
    }

    ALBEDO = vec3(1.0, 0.0, 0.0) * float(FRONT_FACING);
    EMISSION = vec3(5.0, 4.0, 0.0) * (1.0 - clamp(dist / (pulse * 1.5), 0.0, 1.0))
        + (1.0 - float(FRONT_FACING)) * vec3(5.0, 4.0, 0.0);
}
```

## 원리

- **관통선을 표현하는 `start_point`/`end_point`**: 이 예제에서는 값이 고정돼 있지만, 실제로는 무기의 시작/끝 좌표를 매 프레임 uniform으로 넘기면 움직이는 관통 무기에도 그대로 쓸 수 있는 구조입니다.
- **점-직선 최단거리 공식**을 프래그먼트 위치(`frag_pos`, 로컬 버텍스 좌표)에 대해 계산합니다. `dir`는 직선의 방향, `param`은 `frag_pos`를 직선에 투영했을 때의 비율(0~1 사이면 선분 내부), `closest`는 그 투영점입니다.
- **`dist < hole_radius`면 `discard`** — 해당 픽셀을 아예 그리지 않아 반대편이 뚫려 보입니다. 지오메트리를 자르지 않고 프래그먼트 단계에서만 처리하기 때문에 구현이 아주 단순합니다.
- **`cull_disabled` + `FRONT_FACING` 분기**: 컬링을 꺼서 구멍 안쪽의 뒷면(내부 표면)도 그리고, `FRONT_FACING` 여부에 따라 앞면/뒷면 색을 다르게 줘서 "뚫린 단면 안쪽"이 자연스럽게 보이게 합니다.
- **경계 EMISSION 글로우**: `dist`가 `hole_radius`에 가까울수록(막 discard되기 직전) `EMISSION`이 강해지도록 `1.0 - clamp(dist / (pulse * 1.5), 0, 1)`을 곱합니다. 여기에 `cos(TIME * 5.0)`로 만든 `pulse`가 곱해져 있어서, 구멍 가장자리의 빛이 두근거리듯 깜빡입니다.

이 기법의 장점은 **콜리전이나 실제 지오메트리 절단 없이 순수하게 셰이더만으로 "그 자리가 뚫린 것처럼" 보이게 한다**는 점입니다. 실제 물리적 구멍이 필요 없는 연출용 이펙트(관통 연출, 순간이동 자국 등)에 적합합니다.
