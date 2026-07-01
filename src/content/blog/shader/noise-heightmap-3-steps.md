---
title: "노이즈 하이트맵 3단계 — 손으로 짠 파형에서 노멀맵까지"
date: 2026-07-01
summary: "cos/sin 손파형 → FastNoiseLite 텍스처 변위 → 노멀맵 추가, 3단계로 나눠 지형 쉐이더를 키워간 기록."
tags: ["glsl", "3d", "noise", "heightmap"]
category: "shader"
---

![noise heightmap 3 steps](/images/shader/noise-heightmap-3d.gif)

평면 하나를 지형처럼 울퉁불퉁하게 만드는 가장 기본적인 방법부터, 노멀맵으로 디테일을 더하는 단계까지 3개 씬을 나란히 뒀습니다.

## 1단계 — 텍스처 없이 수식만으로

```glsl
shader_type spatial;
uniform sampler2D noise; // 선언은 했지만 아직 쓰지 않음

void vertex() {
    VERTEX.y += cos(VERTEX.x * 4.0) * sin(VERTEX.z * 4.0);
}
```

노이즈 텍스처도 없이 `cos(x) * sin(z)` 하나로 규칙적인 격자 물결을 만듭니다. 완전히 주기적이라 자연스러운 지형과는 거리가 멀지만, "버텍스 셰이더에서 높이를 조작한다"는 개념만 확인하기엔 가장 단순한 형태입니다.

## 2단계 — FastNoiseLite 텍스처로 변위

```glsl
shader_type spatial;
uniform sampler2D noise;
uniform float height_scale = 0.5;

void vertex() {
    float height = texture(noise, VERTEX.xz / 2.0 + 0.5).x;
    VERTEX.y += height * height_scale;
}
```

수식 대신 `NoiseTexture2D`(FastNoiseLite 기반)를 샘플링합니다. `VERTEX.xz / 2.0 + 0.5`로 로컬 XZ 좌표를 0~1 UV 범위로 맞춰 텍스처에 매핑하는 부분이 포인트 — 평면 크기와 노이즈 스케일이 맞물려야 원하는 굴곡 빈도가 나옵니다. 결과는 훨씬 불규칙하고 자연스러운 언덕 모양이 됩니다.

## 3단계 — 노멀맵으로 라이팅 디테일 추가

```glsl
shader_type spatial;
uniform sampler2D noise;
uniform sampler2D normalmap;
uniform float height_scale = 0.5;

varying vec2 tex_position;

void vertex() {
    tex_position = VERTEX.xz / 2.0 + 0.5;
    float height = texture(noise, tex_position).x;
    VERTEX.y += height * height_scale;
}

void fragment() {
    NORMAL_MAP = texture(normalmap, tex_position).xyz;
}
```

2단계와 버텍스 변위는 동일하지만, **같은 노이즈에서 뽑은 노멀맵 텍스처**(`NoiseTexture2D`의 `as_normal_map = true` 옵션)를 `NORMAL_MAP`에 꽂아줍니다. 버텍스 단계의 지오메트리는 저해상도(subdivide 32×32)라 거칠지만, 노멀맵이 조명 계산에 더 촘촘한 굴곡 정보를 더해줘서 실제 표면보다 훨씬 디테일해 보이는 표면처럼 라이팅됩니다. **지오메트리 변위와 노멀맵을 같은 노이즈 소스에서 뽑았기 때문에 둘이 시각적으로 어긋나지 않는다**는 점이 이 3단계 구성의 핵심입니다.
