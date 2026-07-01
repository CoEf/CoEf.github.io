---
title: "texture_blit 셰이더에서 return을 쓸 수 없는 이유"
date: 2026-06-28
summary: "Godot 4.7 DrawableTexture2D의 texture_blit 셰이더 타입에서 blit() 함수 작성 시 주의할 점."
tags: ["glsl", "drawabletexture2d"]
category: "shader"
---

`shader_type texture_blit;`로 작성하는 `blit()` 함수는 일반 `fragment()`와 달리
**`return`문을 쓸 수 없습니다.**

```glsl
void blit() {
    if (!inside_triangle) {
        return; // Error: Using 'return' in the 'blit' processor function is incorrect.
    }
    COLOR0 = vec4(1.0);
}
```

## 대안: 조건부 대입으로 재구성

```glsl
void blit() {
    float alpha = 0.0;
    if (inside_triangle) {
        alpha = compute_strength();
    }
    COLOR0 = vec4(0.0, 0.0, 0.0, alpha);
}
```

`blit()`은 픽셀마다 독립적으로 실행되고 조기 종료 없이 항상 `COLOR0`을
결정해야 하는 구조로 이해하면 됩니다. alpha가 0이면 `blend_mix` 모드에서
기존 픽셀이 그대로 유지됩니다.
