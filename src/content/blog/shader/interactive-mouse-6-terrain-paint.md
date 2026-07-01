---
title: "인터랙티브 쉐이더 6편 — SubViewport 피드백 버퍼로 3D 지형을 실시간으로 칠하기"
date: 2026-07-01
summary: "40x40짜리 저해상도 SubViewport를 붓 자국 누적 버퍼로 써서, 실시간으로 그린 궤적이 3D 지형의 높이·색·투명도에 그대로 반영되는 완성형 데모."
tags: ["glsl", "3d", "interactive", "subviewport", "terrain"]
category: "shader"
---

![mouse interaction step 6](/images/shader/mouse-6-terrain-paint.gif)

5편에서 준비하던 SubViewport 피드백 구조가 여기서 완성된 형태로 쓰입니다. 다만 이 씬은 마우스가 아니라 **방향키로 붓을 조작**합니다 — "포인터 인터랙션"이라는 주제는 이어지지만, 입력 방식은 자유롭게 바뀐 셈입니다.

## 구조

```
방향키 → 브러시 스프라이트 이동 (SubViewport 안, 40x40 저해상도)
              │
              ▼
   SubViewport.get_texture() 를 noise1로 사용
              │
              ▼
   3D 지형 셰이더(snow.gdshader)가 noise1(붓자국) + noise2(디테일 노이즈)로
   높이/노멀/알파를 계산 → 실시간으로 지형이 "칠해짐"
```

```gdscript
# 브러시 스프라이트 — 방향키 + 가속/마찰로 부드럽게 이동
func _physics_process(delta):
    var input_vector = Vector2(Input.get_axis("ui_left","ui_right"), Input.get_axis("ui_up","ui_down"))
    if input_vector.length() > 0:
        velocity = velocity.move_toward(input_vector.normalized() * speed, acceleration * speed * delta)
    else:
        velocity = velocity.move_toward(Vector2.ZERO, friction * speed * delta)
    position += velocity * delta
```

```glsl
// 지형 셰이더 (3~4편의 trail_map과 본질적으로 같은 아이디어)
uniform sampler2D noise1; // SubViewport 출력 — 붓이 지나간 자리
uniform sampler2D noise2; // FastNoiseLite — 잔디 표면의 잔디결 디테일

void vertex() {
    float height = texture(noise1, UV).x + texture(noise2, UV).x * 0.25;
    VERTEX += NORMAL * height * height_scale;
    v_height = height * height_scale;
}

void fragment() {
    float brightness = clamp((v_height + 1.0) * 0.5, 0.0, 1.0);
    ALBEDO = base_color.rgb * brightness;
    ALPHA = base_color.a * smoothstep(0.0, 0.3, v_height);
}
```

## 이 단계가 3~4편과 다른 점

3~4편의 `trail_map`은 **고정된 이미지**였습니다. 여기서는 `noise1`이 **매 프레임 실제로 갱신되는 `SubViewport`의 렌더 결과**입니다. `SubViewportContainer`를 화면 구석에 40×40 픽셀이라는 아주 작은 크기로 배치한 게 포인트 — 사람이 볼 필요는 없고, 오직 **데이터(붓자국 마스크)를 담는 텍스처**로만 쓰기 때문에 해상도를 최소화했습니다.

브러시가 지나간 자리는 `noise1`의 밝기가 올라가고, 그 값이 그대로 버텍스 높이(`VERTEX += NORMAL * height`)와 알파에 반영됩니다. 그 결과 **붓으로 지나간 자리만 지형이 솟아오르고 불투명해지는** — 3~4편에서 "언젠가 되면 좋겠다"고 남겨뒀던 실시간 트레일이, 여기서는 2D 색이 아니라 3D 지오메트리 변형으로 완성된 셈입니다.

## 이 시리즈 전체를 돌아보면

1~2편(유니폼 전달, 거리 계산) → 3~4편(트레일을 정적 텍스처로 프로토타이핑) → 5편(진짜 피드백 버퍼 인프라 준비, 미완성) → 6편(그 인프라를 3D에 적용해 완성)까지, **"마우스/포인터 반응"이라는 같은 주제를 점점 더 근본적인 해결책으로 재구현해나가는 과정** 자체가 이 폴더의 진짜 기록입니다.
