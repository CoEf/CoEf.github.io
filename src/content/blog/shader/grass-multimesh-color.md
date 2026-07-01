---
title: "MultiMesh 잔디 쉐이더 — 뿌리/끝 그라디언트 + 월드 노이즈로 색 편차주기"
date: 2026-07-01
summary: "블레이드 UV로 뿌리-끝 색을 섞고, 월드 좌표 노이즈로 패치마다 색을 다르게 주는 잔디 쉐이더."
tags: ["glsl", "3d", "multimesh", "grass"]
category: "shader"
---

![grass](/images/shader/grass-3d.gif)

바람 애니메이션은 없는, **정적인 색 처리에 집중한** 잔디 쉐이더입니다. `MultiMeshInstance3D`로 블레이드를 대량 배치하고, 색만으로 자연스러운 잔디밭을 만듭니다.

## 핵심 코드

```glsl
shader_type spatial;
render_mode cull_disabled;

uniform vec3 color : source_color;
uniform vec3 color2 : source_color;
uniform sampler2D noise;
uniform float noiseScale = 20.0;

varying vec3 worldPos;

void vertex() {
    worldPos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
    vec3 noiseLevel = texture(noise, worldPos.xz / noiseScale).rgb;
    ALBEDO = mix(color, color2, 1.0 - UV.y) * mix(color, color2, noiseLevel.r);
    if (!FRONT_FACING) {
        NORMAL = -NORMAL;
    }
}
```

## 원리

- **`mix(color, color2, 1.0 - UV.y)`**: 블레이드 메시의 UV.y를 뿌리(0)~끝(1) 기준으로 사용해, 끝으로 갈수록 `color2`(밝은 초록) 쪽으로 섞습니다. 잔디 끝이 더 밝거나 마른 색으로 보이는 그라디언트입니다.
- **`worldPos.xz / noiseScale`로 샘플링한 노이즈를 두 번째 `mix`에 다시 사용** — 이번엔 UV가 아니라 **월드 좌표** 기준이라, 같은 블레이드 메시를 복제해도 잔디밭 전체에 걸쳐 패치별로 색이 달라집니다. 두 `mix` 결과를 곱해서 "블레이드 안의 그라디언트"와 "패치 단위의 색 편차"를 동시에 표현합니다.
- **`render_mode cull_disabled` + `if (!FRONT_FACING) NORMAL = -NORMAL;`**: 잔디 블레이드는 보통 한 장짜리 평면(양면 렌더링)이라, 뒷면이 보일 때 노멀을 뒤집어주지 않으면 뒷면이 검게 나옵니다. 컬링을 끄고 뒷면 노멀을 직접 반전시켜 양쪽 다 정상적으로 라이팅을 받게 만드는 흔한 트릭입니다.

## MultiMesh와의 조합

이 쉐이더 자체는 인스턴스 개수나 배치를 몰라도 됩니다 — `worldPos`만 알면 되기 때문에, `MultiMeshInstance3D`가 블레이드를 몇 개, 어디에 뿌리든 그대로 동작합니다. 색 편차 로직과 인스턴싱 로직이 완전히 분리되어 있는 게 이 구조의 장점입니다.
