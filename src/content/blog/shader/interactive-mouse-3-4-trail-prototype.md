---
title: "인터랙티브 쉐이더 3~4편 — 트레일 셰이더를 정적 텍스처로 먼저 검증하기"
date: 2026-07-01
summary: "실시간 누적 버퍼 없이, 고정된 텍스처를 trail_map 자리에 임시로 꽂아 색-블렌드/알파-지우기 두 가지 트레일 표현 방식을 먼저 검증한 프로토타입 단계."
tags: ["glsl", "2d", "interactive", "mouse", "prototype"]
category: "shader"
---

![mouse interaction step 3](/images/shader/mouse-3-color-trail.gif)

3편과 4편은 같은 아이디어를 실험합니다 — **"마우스가 지나간 자리가 남는 것처럼 보이려면 셰이더가 뭘 해야 하는가"**. 다만 둘 다 아직 **진짜 트레일 버퍼(매 프레임 누적되는 텍스처)는 없습니다.** `trail_map` 자리에 정적인 노이즈 텍스처(3편)나 고정 PNG(4편)를 임시로 꽂아, "매 프레임 흘러들어오는 데이터가 있다면 그걸로 뭘 그릴지"만 먼저 검증한 프로토타입입니다.

## 3편 — 트레일을 색으로 표현

```glsl
uniform sampler2D trail_map;   // 지금은 NoiseTexture2D를 임시로 꽂아둠
uniform vec2 mouse_uv;
uniform float brush_size = 0.02;
uniform float decay_rate = 0.95;

void fragment() {
    vec4 trail_value = texture(trail_map, UV);

    if (distance(UV, mouse_uv) < brush_size) {
        trail_value.r = 1.0;
    }
    trail_value.r *= decay_rate;

    vec3 trail_color = vec3(0.0, trail_value.r, 0.0);
    COLOR = vec4(mix(original_color.rgb, trail_color, trail_value.r), original_color.a);
}
```

`trail_map`에서 읽은 값과 "지금 마우스가 여기 있는가"를 합쳐서 **초록색으로 섞어 넣는(mix)** 방식입니다.

## 4편 — 트레일을 알파로 표현

```glsl
// 3편과 유니폼은 동일, fragment() 마지막만 다름
vec4 trail_color = vec4(0.0, trail_value.r, 0.0, trail_value.r);
COLOR = vec4(original_color.rgb, 1.0 - trail_color.a);
```

색은 전혀 건드리지 않고, **알파(투명도)만 깎아서 마우스가 지나간 자리가 점점 투명해지게** 만듭니다. 같은 `trail_value.r`을 완전히 다른 용도(색 vs 투명도)로 쓸 수 있다는 걸 보여주는 대비입니다.

## 왜 아직 "진짜" 트레일이 아닌가

두 셰이더 모두 `trail_map`을 **매 프레임 다시 그려 넣는 코드가 없습니다.** 스크립트는 `mouse_uv`만 갱신할 뿐, `trail_map` 자체는 씬에 저장된 고정 텍스처(3편: 랜덤 노이즈, 4편: 발광 텍스처 PNG)를 계속 그대로 읽습니다. 그래서 "감쇠(decay)"처럼 보이는 부분도 사실은 고정된 이미지 위에 현재 마우스 위치만 실시간으로 얹히는 것이지, 지나간 궤적이 실제로 누적되지는 않습니다.

진짜 누적이 되려면 `trail_map`이 **이전 프레임의 자기 자신 출력**이어야 합니다 — 이건 5편에서 `SubViewport`로 시도합니다.
