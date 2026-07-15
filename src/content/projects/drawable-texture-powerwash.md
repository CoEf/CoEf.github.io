---
title: "PowerWash Simulator - with DrawableTexture2D"
summary: "DrawableTexture2D와 3D 역투영으로 UV 심 문제를 해결하며 PowerWash Simulator를 구현한 기록"
status: "completed"   # in-progress | completed | archived
stack: ["Godot 4", "GDScript", "GLSL"]
role: "1인 개발"
startDate: 2026-06-19
coverImage: "/images/powerwash/powerwash-hero.png"
order: 1                 # 목록 정렬 순서, 낮을수록 먼저
---

# UV 보간의 함정과 3D 역투영 — Godot 4.7로 PowerWash Simulator 구현하기

> **개인 프로젝트 | Godot 4.7 · GDScript · GLSL | 2026.06**

![PowerWash 플레이 화면](/images/powerwash/powerwash-hero.png)
*더러운 인형 모델을 노즐로 분사해 닦아내는 PowerWash Simulator. 상단에 진행도(%)와 노즐 정보가 표시된다.*

---

## 시작: Painter의 파이프라인을 반대로 써보다

[3D 텍스처 페인터](/projects/drawable-texture-painter/)를 GDScript로 포팅하고 나니, `DrawableTexture2D` 파이프라인(셰이더로 텍스처를 직접 읽고 쓰는 구조)이 손에 익었습니다. 이 파이프라인을 반대 방향으로 쓰면 — 색을 **더하는** 게 아니라 dirt를 **지우는** 방향으로 — PowerWash Simulator를 만들 수 있겠다는 아이디어가 자연스럽게 이어졌습니다.

단순한 클론 게임보다는 **GPU 텍스처 파이프라인과 3D→UV 변환을 직접 설계하는 기술적 챌린지**로 접근하기로 했고, 실제로 진행하면서 Painter에서는 몰랐던(혹은 넘어갔던) 문제 두 가지를 정면으로 마주쳤습니다. 아래에서 그 과정을 정리합니다.

---

## 전체 구조 한눈에 보기

씬은 `powerwash_main.tscn` 하나, 스크립트는 `powerwash_controller.gd` 하나만 씬에 미리 붙어 있습니다. Painter와 똑같은 패턴으로, 나머지는 전부 실행 시점에 코드로 생성됩니다.

<div class="tree">
  <div class="tree-root">
    <span class="tree-root-name">PowerWashMain <em>(Node3D)</em></span>
    <span class="tree-root-file">powerwash_controller.gd</span>
    <span class="tree-desc">입력을 받고 "언제 분사할지"만 결정</span>
  </div>
  <ul>
    <li>
      <span class="tree-node">동적 컴포넌트</span>
      <span class="tree-desc">_ready()에서 생성</span>
      <ul>
        <li><code>DirtCanvasComponent</code><span class="tree-desc">dirt_mask/coverage_mask 소유, 실제 지우기 실행</span></li>
        <li><code>SurfacePickerComponent</code><span class="tree-desc">화면 좌표 → UV / 3D 위치 / 삼각형 탐색 <em>(Painter와 공유)</em></span></li>
        <li><code>CursorComponent</code><span class="tree-desc">3D 커서 + 스프레이 표시 <em>(Painter와 공유)</em></span></li>
        <li><code>ProgressComponent</code><span class="tree-desc">GPU→CPU 리드백으로 진행도 계산</span></li>
      </ul>
    </li>
    <li>
      <span class="tree-node">씬 노드</span>
      <ul>
        <li><code>OrbitCamera</code><span class="tree-desc">궤도 카메라 <em>(Painter와 공유, 입력은 컨트롤러가 해석)</em></span></li>
        <li><code>Plushy</code><span class="tree-desc">닦을 대상 3D 모델 · material_override: ShaderMaterial(dirt_surface.gdshader)</span></li>
      </ul>
    </li>
    <li>
      <span class="tree-node">데이터 리소스</span>
      <ul>
        <li><code>NozzlePreset</code><span class="tree-desc">노즐 1개 = 분사 크기·압력·분사 패턴 텍스처</span></li>
      </ul>
    </li>
    <li>
      <span class="tree-node">셰이더 <em>(전부 PowerWash 전용)</em></span>
      <ul>
        <li><code>dirt_surface.gdshader</code><span class="tree-desc">dirt_mask를 읽어 clean↔dirty를 블렌딩하는 spatial 셰이더</span></li>
        <li><code>erase_dirt_3d.gdshader</code><span class="tree-desc">실제 사용 중인 3D 역투영 지우기 셰이더</span></li>
        <li><code>init_dirt.gdshader</code><span class="tree-desc">시작 시 디자이너가 지정한 초기 더러움 패턴을 굽는 셰이더</span></li>
        <li><code>init_coverage.gdshader</code><span class="tree-desc">UV 커버리지 마스크를 한 번 굽는 셰이더</span></li>
      </ul>
    </li>
  </ul>
</div>

핵심 원칙도 Painter와 동일합니다.

> **컨트롤러는 "언제" 분사할지만 결정하고, "어떻게" 지울지·"얼마나" 닦였는지는 컴포넌트가 안다.**

---

## 기본 아이디어: 역방향 페인팅

아이디어 자체는 단순합니다.

| | 3D 페인터 (Painter) | PowerWash |
|---|---|---|
| 텍스처 초기 상태 | R=0 (빈 캔버스) | R=1 (전체 더러움) |
| 브러시 동작 | R 증가 → 색 추가 | R 감소 → dirt 제거 |
| 진행도 개념 | 없음 | "얼마나 닦았나" (%) |

`dirt_mask`(`DrawableTexture2D`)의 R값이 `1.0`이면 완전히 더럽고 `0.0`이면 깨끗합니다. `dirt_surface.gdshader`가 매 프레임 이 값을 읽어 모델 표면 색을 결정합니다.

```glsl
// dirt_surface.gdshader
void fragment() {
    float dirt = texture(dirt_mask, UV).r;

    vec3 clean = texture(clean_albedo, UV).rgb;
    ALBEDO = mix(clean, dirt_color, dirt);

    vec3 n = texture(clean_normal, UV).rgb;
    NORMAL_MAP = mix(n, vec3(0.5, 0.5, 1.0), dirt * 0.7);

    float r = texture(clean_roughness, UV).r;
    ROUGHNESS = mix(r, dirt_roughness, dirt);
    METALLIC = 0.0;
    AO = mix(1.0, 0.72, dirt);
}
```

**왜 이렇게 했나**: albedo·normal·roughness·AO 네 값 전부를 `dirt` 하나의 비율로 `mix()`하면, dirt_mask 텍스처 한 장만 갱신해도 표면 전체의 시각적 변화(색이 탁해지고, 요철이 죽고, 거칠어지고, 그림자가 살짝 깊어지는 것)가 한꺼번에 따라옵니다. Painter가 albedo/normal/orm 세 장을 동시에 칠해야 했던 것과 달리, PowerWash는 이 dirt_mask 한 장만 다루면 되는 만큼 파이프라인 자체는 더 단순합니다.

### dirt_mask는 어떻게 초기화되나

`DirtCanvasComponent.setup()`은 씬 인스펙터에 디자이너가 지정한 아무 텍스처(예: 그림자국처럼 보이는 그레이스케일 이미지)를 초기 더러움 패턴으로 구워 넣습니다.

```gdscript
func setup(target_model: MeshInstance3D, texture_size: Vector2i, erase_material: ShaderMaterial) -> bool:
    var surface_mat := target_model.material_override as ShaderMaterial
    var initial_tex := surface_mat.get_shader_parameter("dirt_mask") as Texture2D
    if initial_tex is DrawableTexture2D:
        initial_tex = null  # 에디터에 남아있던 이전 DrawableTexture2D는 복사할 의미가 없음

    _dirt_mask = DrawableTexture2D.new()
    _dirt_mask.setup(texture_size.x, texture_size.y,
        DrawableTexture2D.DRAWABLE_FORMAT_RGBA8, Color(1.0, 1.0, 1.0, 1.0), false)

    if initial_tex != null:
        var init_mat := ShaderMaterial.new()
        init_mat.shader = _INIT_SHADER  # init_dirt.gdshader
        init_mat.set_shader_parameter("texture_size", Vector2(texture_size))
        _dirt_mask.blit_rect_multi(Rect2(Vector2.ZERO, Vector2(texture_size)),
            [initial_tex], [_dummy_drawable], Color.WHITE, 0, init_mat)

    surface_mat.set_shader_parameter("dirt_mask", _dirt_mask)
    return true
```

**왜 이렇게 했나**: `dirt_mask`는 코드로 새로 만드는 `DrawableTexture2D`라 처음엔 아무 이미지도 갖고 있지 않습니다. 디자이너가 인스펙터에서 지정해둔 텍스처(정적 이미지)를 `init_dirt.gdshader`로 딱 한 번 구워서 `DrawableTexture2D`로 옮겨야, 이후 지우기 셰이더가 매 프레임 이 텍스처에 blit할 수 있습니다. 재미있게도 씬 파일을 보면 이 초기 더러움 패턴으로 Painter의 브러시용 PBR 텍스처였던 `Metal062C_Metalness.jpg`를 그대로 재활용하고 있습니다 — 회색 얼룩 텍스처는 금속 맵으로도, 때 자국으로도 쓸 수 있다는 뜻이죠.

한 가지 API상의 제약도 여기서 드러납니다. `blit_rect_multi()`는 소스·추가 출력 배열이 **비어있으면 안 된다**는 조건이 있는데, PowerWash는 출력할 텍스처가 `dirt_mask` 한 장뿐입니다. 그래서 1×1 흰색 `_dummy_source`와 같은 크기의 `_dummy_drawable`을 만들어 이 조건만 만족시키고, 셰이더에서는 실제로 읽거나 쓰지 않습니다 — API 제약을 맞추기 위한 더미 인자입니다.

---

## 지우기: 2D 스탬프 방식부터

분사 버튼을 누르면 `texture_blit` 셰이더가 `dirt_mask`의 해당 픽셀 R값을 줄입니다. 초기 버전은 Painter의 `paint_segment()`와 똑같은 방식이었습니다 — UV 좌표를 얻어 이전 UV와 현재 UV 사이를 `lerp`로 보간하며 스탬프를 찍는 것.

```glsl
// erase_dirt.gdshader — UV 공간 스탬프
void blit() {
    float dist = length(UV * 2.0 - 1.0);
    float circle = 1.0 - smoothstep(0.3, 1.0, dist);
    float pattern = texture(spray_pattern, UV * pattern_scale + pattern_offset).r;
    float erase_strength = circle * pattern * pressure;

    // blend_mix: result = 0 × strength + dirt × (1 - strength)
    COLOR0 = vec4(0.0, 0.0, 0.0, erase_strength);
}
```

**왜 이렇게 했나**: `blend_mix` 렌더 모드의 합성 공식(`result = src.rgb × src.a + dst.rgb × (1 - src.a)`)을 이용하면, `COLOR0 = vec4(0, 0, 0, erase_strength)` 한 줄만으로 "검은색을 `erase_strength` 비율만큼 섞어서 dirt 값을 줄인다"가 성립합니다. 노즐마다 다른 `spray_pattern` 텍스처(구멍 뚫린 무늬)를 곱해주면 균일한 원이 아니라 노즐 모양대로 지워집니다.

Painter의 UV lerp와 완전히 같은 접근이었던 만큼, 문제도 똑같이 따라왔습니다.

---

## Painter에서 물려받은 문제, 여기서 크게 터지다: UV 심

[Painter 포팅기](/projects/drawable-texture-painter/)에서 이미 짚었듯, UV 공간에서 두 좌표 사이를 `lerp`로 보간하는 방식은 원작자도 README에 "UV 아일랜드를 넘으면 깨진다"고 적어뒀을 만큼 알려진 한계였습니다. Painter에서는 브러시가 크고 프레임 간 이동량이 작아서 잘 드러나지 않았지만, PowerWash에서는 사정이 달랐습니다. **진행도(%)를 정확히 계산해야 하다 보니, 화면을 빠르게 문지르는 게 정상적인 플레이 방식**이었고, 그럴수록 심 경계를 넘는 드래그가 훨씬 잦고 훨씬 눈에 띄게 문제를 일으켰습니다.

테스트를 돌리자마자 이상한 현상이 나타났습니다. 인형 모델의 특정 부위를 드래그하면 **전혀 다른 위치가 지워지는** 것이었습니다.

![UV 심을 넘는 드래그가 엉뚱한 위치를 지우는 모습](/images/painter/painter-uv-seam.gif)
*Painter에서 겪은 것과 완전히 같은 상황 — UV 아일랜드 경계를 넘는 드래그가 중간 경로의 엉뚱한 영역을 건드린다.*

### 원인 분석

UV 아틀라스를 펼쳐보니 바로 보였습니다.

```
3D 공간:  모델 오른쪽 어깨 표면을 좌 → 우로 드래그
UV 공간:  UV_A = (0.98, 0.42)  →  UV_B = (0.02, 0.42)
          [텍스처 오른쪽 끝]       [텍스처 왼쪽 끝]

lerp(UV_A, UV_B, t):
  t=0.0 → (0.98, 0.42) ✓
  t=0.5 → (0.50, 0.42) ← 텍스처 중앙, 실제로는 엉뚱한 위치!
  t=1.0 → (0.02, 0.42) ✓
```

3D 공간에서는 연속된 표면이지만, UV 공간에서는 텍스처 왼쪽 끝과 오른쪽 끝으로 분리되어 있습니다. 두 UV 좌표 사이를 단순 보간하면 중간 경로가 텍스처의 엉뚱한 영역을 통과합니다.

### Method B: 임시 방어

빠른 픽스로 **3D/UV 이동량 비율 판별**을 도입했습니다.

```gdscript
var uv_delta := current_uv.distance_to(_last_uv)
var world_delta := current_world.distance_to(_last_world_pos)
var uv_per_world := uv_delta / max(world_delta, 0.001)

if uv_per_world > SEAM_THRESHOLD:
    # UV 심 구간으로 판단 — 현재 프레임 스킵
    _last_uv = current_uv
    _last_world = current_world
    return
```

UV 심을 건너는 순간 `uv_per_world` 값이 폭등한다는 점을 이용한 방법입니다. 테스트 모델에서는 95% 케이스를 막아줬지만, 구조적 문제는 그대로였습니다.

> **"UV 공간에서 보간한다"는 전제 자체가 틀렸다.**

모델마다 심의 위치가 다르고, 카메라 각도나 드래그 속도에 따라 임계값을 계속 튜닝해야 했습니다. 언제든 다시 터질 수 있는 시한폭탄이었습니다.

---

## Method C: 3D 역투영으로 UV 보간 자체를 제거하다

블렌더가 3D 페인팅을 어떻게 구현하는지 찾아봤습니다. 블렌더는 UV 공간에서 선을 긋지 않고, **3D 공간의 브러시가 닿는 삼각형마다 해당 UV 영역에 직접 blit**합니다. UV 보간이 없으면 UV 심 문제도 존재할 수 없습니다.

### 브러시 캡슐과 겹치는 삼각형 찾기

"이전 위치 → 현재 위치"를 캡슐(선분 + 반지름)로 표현하고, 그 캡슐과 겹치는 모든 삼각형을 한 번에 모읍니다. 이 함수는 `SurfacePickerComponent`에 있어서 Painter 씬에서도 그대로 쓸 수 있는 코드입니다.

```gdscript
# surface_picker_component.gd
func get_triangles_in_capsule(world_a: Vector3, world_b: Vector3, radius: float) -> Array[Dictionary]:
    var result: Array[Dictionary] = []
    var inverse_transform := _plushy.global_transform.inverse()
    var local_a := inverse_transform * world_a
    var local_b := inverse_transform * world_b

    var model_scale: float = _plushy.global_basis.get_scale().x
    var local_radius: float = radius / maxf(model_scale, 1e-6)
    var radius_sq: float = local_radius * local_radius

    # 세그먼트를 따라 일정 간격으로 샘플링해 빠른 드래그도 놓치지 않고 커버
    var seg_length: float = local_a.distance_to(local_b)
    var sample_count: int = maxi(1, ceili(seg_length / maxf(local_radius, 1e-5)))

    for i in range(0, _faces.size(), 3):
        var pa: Vector3 = _faces[i]; var pb: Vector3 = _faces[i + 1]; var pc: Vector3 = _faces[i + 2]
        for s in range(sample_count + 1):
            var t := float(s) / float(sample_count)
            var sample_point := local_a.lerp(local_b, t)
            var closest := _closest_point_on_triangle(sample_point, pa, pb, pc)
            if sample_point.distance_squared_to(closest) <= radius_sq:
                result.append({"positions": [pa, pb, pc], "uvs": [_uvs[i], _uvs[i+1], _uvs[i+2]]})
                break  # 한 번만 맞으면 충분 — 다음 삼각형으로
    return result
```

**왜 이렇게 했나**: 캡슐과 삼각형의 정확한 최단거리를 매 쌍마다 계산하는 대신, 선분을 반지름 간격으로 촘촘히 샘플링해서 "각 샘플 지점에서 삼각형까지의 최단거리"로 근사합니다. 정확도는 살짝 양보하지만 구현이 단순하고, 빠른 드래그에서도 중간 구간의 삼각형을 놓치지 않습니다.

### 삼각형 하나마다 직접 blit

`DirtCanvasComponent.erase_at_3d()`는 위에서 찾은 삼각형마다 UV 바운딩 박스를 구해 그 자리에 딱 맞춰 blit합니다.

```gdscript
func erase_at_3d(local_a: Vector3, local_b: Vector3, local_radius: float,
                  triangles: Array[Dictionary], nozzle: NozzlePreset) -> void:
    _erase_3d_material.set_shader_parameter("brush_a", local_a)
    _erase_3d_material.set_shader_parameter("brush_b", local_b)
    _erase_3d_material.set_shader_parameter("brush_radius", local_radius)
    _erase_3d_material.set_shader_parameter("pressure", nozzle.pressure)

    for tri in triangles:
        var uvs: Array = tri.uvs
        var uv_min := Vector2(minf(minf(uvs[0].x, uvs[1].x), uvs[2].x), minf(minf(uvs[0].y, uvs[1].y), uvs[2].y))
        var uv_max := Vector2(maxf(maxf(uvs[0].x, uvs[1].x), uvs[2].x), maxf(maxf(uvs[0].y, uvs[1].y), uvs[2].y))
        var rect := Rect2(uv_min * Vector2(_texture_size), (uv_max - uv_min) * Vector2(_texture_size)).grow(1.0)

        _erase_3d_material.set_shader_parameter("tri_uv0", uvs[0])
        # ... tri_uv1/2, tri_pos0/1/2도 동일하게 설정
        _dirt_mask.blit_rect_multi(rect, [_dummy_source], [_dummy_drawable], Color(1,1,1,1), 0, _erase_3d_material)
```

핵심 셰이더는 `erase_dirt_3d.gdshader`입니다.

```glsl
shader_type texture_blit;
render_mode blend_mix;

uniform vec2 tri_uv0; uniform vec2 tri_uv1; uniform vec2 tri_uv2;
uniform vec3 tri_pos0; uniform vec3 tri_pos1; uniform vec3 tri_pos2;
uniform vec3 brush_a; uniform vec3 brush_b;
uniform float brush_radius = 0.05;
uniform float pressure : hint_range(0.0, 1.0) = 1.0;

const float EDGE_EPS = 0.01;  // 삼각형 경계 1px 여유 — 이웃 삼각형과 심 없이 맞물리도록

void blit() {
    // 블릿 rect 내부 상대 좌표(UV)가 아닌, 텍스처 전체 기준 절대 좌표가 필요
    vec2 uv = FRAGCOORD.xy / texture_size;

    vec3 bary;
    bool valid = barycentric(uv, bary);
    bool inside = valid && bary.x >= -EDGE_EPS && bary.y >= -EDGE_EPS && bary.z >= -EDGE_EPS;

    float erase_strength = 0.0;
    if (inside) {
        vec3 local_pos = tri_pos0 * bary.x + tri_pos1 * bary.y + tri_pos2 * bary.z;
        float dist = dist_to_segment(local_pos, brush_a, brush_b);
        float falloff = 1.0 - smoothstep(brush_radius * 0.3, brush_radius, dist);
        erase_strength = falloff * pressure;
    }

    // 삼각형 밖(alpha=0)은 기존 픽셀 그대로 — 인접 UV 섬을 절대 침범하지 않음
    COLOR0 = vec4(0.0, 0.0, 0.0, erase_strength);
}
```

이 방식의 핵심은 **삼각형마다 독립적으로 blit**한다는 점입니다. UV 심 양쪽 삼각형은 서로 다른 UV 영역에 blit되고, 두 영역 사이에는 아무런 보간도 일어나지 않습니다. 심 아티팩트가 구조적으로 불가능해집니다.

### texture_blit 셰이더에서 마주친 함정

구현 중 에러 하나가 바로 나왔습니다.

```
Error at line 65: Using 'return' in the 'blit' processor function is incorrect.
```

`texture_blit` 셰이더의 `void blit()`은 `return`문 자체가 문법 오류입니다. "삼각형 밖이면 조기 return" 하려던 코드를 `if (inside)` 분기로 재구성해야 했습니다 — `erase_strength = 0.0` 초기값을 두고 삼각형 안쪽일 때만 값을 계산하는 지금 구조가 그 결과입니다.

![3D 역투영으로 심 없이 지워지는 모습](/images/powerwash/powerwash-fixed-spray.gif)
*같은 자리를 빠르게 문질러도 더 이상 엉뚱한 위치가 지워지지 않는다 — 삼각형별로 독립적으로 blit한 결과.*

---

## 진행도 계산의 두 번째 함정: coverage mask

3D 역투영으로 심 문제를 해결하고 나서 다음 문제가 나타났습니다. 눈에 보이는 dirt를 80% 정도 닦았는데 progress bar는 50%를 가리키는 것이었습니다.

### 원인

UV 아틀라스에는 **어떤 삼각형도 매핑되지 않는 빈 공간**이 있습니다. `dirt_mask` 초기 상태가 solid white(R=1.0)이므로, 이 빈 공간도 전부 "더러움"으로 계산에 포함됩니다.

```
dirty_pixels / total_pixels = 실제 표면 80% + 빈 UV 공간 100%
                             ≠ 시각적으로 느끼는 청소량
```

이 문제는 Painter에는 아예 존재하지 않았습니다. Painter는 "얼마나 그렸나"를 수치화할 필요가 없었으니까요. PowerWash에서 진행도(%)라는 개념을 새로 도입하면서 처음 마주친, 순수하게 이 프로젝트만의 문제입니다.

### UV 커버리지 마스크

해결책은 **어떤 픽셀이 실제 삼각형인지 미리 마킹**하는 것입니다. 게임 시작 시 모든 삼각형을 `coverage_mask`에 래스터라이즈하고, 진행도 계산 시 이 마스크 R=1인 픽셀만 분모에 포함합니다.

```glsl
// init_coverage.gdshader — 삼각형 하나당 한 번 호출
void blit() {
    vec2 uv = FRAGCOORD.xy / texture_size;
    vec3 bary;
    bool inside = barycentric(uv, bary)
        && bary.x >= -EDGE_EPS && bary.y >= -EDGE_EPS && bary.z >= -EDGE_EPS;

    // 안쪽(alpha=1) → R=1로 덮어씀, 바깥(alpha=0) → blend_mix가 기존 값 유지
    float a = inside ? 1.0 : 0.0;
    COLOR0 = vec4(1.0, 1.0, 1.0, a);
}
```

`ProgressComponent`는 1초 간격으로 `dirt_mask`를 32×32까지 다운샘플링해 GPU→CPU 리드백하고, `coverage_mask`로 가중 평균을 냅니다.

```gdscript
# progress_component.gd
const SAMPLE_RES := 32
const CLEAR_THRESHOLD := 0.02  # 평균 dirt 2% 이하 → 클리어

func _sample() -> void:
    var img_dirt := _dirt_mask.get_image()
    img_dirt.resize(SAMPLE_RES, SAMPLE_RES, Image.INTERPOLATE_BILINEAR)

    var img_cov := _coverage_mask.get_image()
    img_cov.resize(SAMPLE_RES, SAMPLE_RES, Image.INTERPOLATE_BILINEAR)

    var covered := 0.0
    var dirty := 0.0
    for y in SAMPLE_RES:
        for x in SAMPLE_RES:
            var c := img_cov.get_pixel(x, y).r      # 1 = 실제 삼각형 있음
            covered += c
            dirty += img_dirt.get_pixel(x, y).r * c  # 커버된 픽셀만 dirt 누적

    var avg_dirt := dirty / maxf(covered, 1.0)        # 빈 UV 공간 완전히 제외
    var pct := clampf((1.0 - avg_dirt) * 100.0, 0.0, 100.0)
    progress_updated.emit(pct)

    if avg_dirt <= CLEAR_THRESHOLD:
        level_cleared.emit()
```

**왜 이렇게 했나**: `covered`(커버리지 합)를 분모로 쓰면 UV 아일랜드가 차지하지 않는 텍스처 영역은 애초에 계산에서 빠집니다. 커버리지 마스크 빌드는 게임 시작 시 딱 한 번뿐이고, 런타임 비용은 1초마다 32×32 리드백뿐이라 성능 부담이 거의 없습니다.

---

## 구조를 정리한 부분: 컨트롤러/컴포넌트 패턴

Painter에서 이미 정리해둔 "컨트롤러는 언제, 컴포넌트는 어떻게" 패턴을 그대로 이어받았습니다. 씬에는 컨트롤러 스크립트만 있고, 나머지는 `_ready()`에서 동적으로 생성됩니다.

```gdscript
func _ready() -> void:
    _canvas = _add_component(DirtCanvasComponent, "DirtCanvas")
    _picker = _add_component(SurfacePickerComponent, "SurfacePicker")
    _cursor_component = _add_component(CursorComponent, "Cursor")
    _progress = _add_component(ProgressComponent, "Progress")

    _canvas.setup(target_model, texture_size, erase_material)
    _picker.setup(target_model)
    _uv_to_world_scale = _picker.get_uv_to_world_scale()

    # 커버리지 마스크는 시작 시 한 번만 빌드
    _canvas.build_coverage(_picker.get_all_triangles())
    _progress.setup(_canvas.get_dirt_mask())
    _progress.set_coverage_mask(_canvas.get_coverage_mask())
    _progress.progress_updated.connect(_on_progress_updated)
    _progress.level_cleared.connect(_on_level_cleared)
```

분사 로직도 역할이 명확히 나뉩니다. 컨트롤러는 "언제 분사할지"만 판단합니다.

```gdscript
func _spray(current_world: Vector3) -> void:
    var nozzle := nozzles[_selected_nozzle]
    var uv_radius := (nozzle.spray_size_px * 0.5) / float(texture_size.x)
    var brush_radius := uv_radius * _uv_to_world_scale * brush_radius_scale

    var from_world := _last_world_pos if _spraying else current_world
    _spraying = true
    _last_world_pos = current_world

    var triangles := _picker.get_triangles_in_capsule(from_world, current_world, brush_radius)
    var inv := target_model.global_transform.inverse()
    _canvas.erase_at_3d(inv * from_world, inv * current_world,
        brush_radius / target_model.global_basis.get_scale().x, triangles, nozzle)
```

**왜 이렇게 나눴나**: 노즐 픽셀 크기를 3D 반경으로 환산하고 "이전 위치 → 현재 위치" 캡슐을 만드는 건 컨트롤러의 몫이고, 그 캡슐로 무엇을 할지(삼각형 탐색, blit)는 각각 `SurfacePickerComponent`와 `DirtCanvasComponent`가 압니다. 컨트롤러는 텍스처를 직접 만지지 않고, 컴포넌트는 입력을 직접 읽지 않습니다.

이 경계를 Painter에서 미리 그어둔 덕분에, PowerWash를 만들 때 `SurfacePickerComponent`·`CursorComponent`·`OrbitCamera` 세 파일은 **코드를 한 줄도 고치지 않고** 그대로 가져다 썼습니다. 다만 `SurfacePickerComponent`에는 PowerWash를 위해 `get_triangles_in_capsule()`·`get_uv_to_world_scale()`·`get_uv_and_world()` 세 메서드가 새로 추가됐는데, 기존 Painter 코드(`get_uv`, `get_pose`)를 건드리지 않고 같은 파일에 이어 붙이기만 했으므로 Painter 씬은 영향을 받지 않았습니다.

---

## Painter와 비교하면 무엇이 달라졌나

| | Painter | PowerWash |
|---|---|---|
| UV 좌표 보간 | 여전히 `lerp` (문제 있음, 방치) | 3D 역투영으로 보간 자체를 제거 |
| 텍스처 채널 | albedo/normal/orm 3장 동시 블릿 | dirt_mask 1장만 관리 |
| "얼마나 진행됐나" | 개념 없음 | coverage 가중 진행도 (신규 문제, 신규 해결) |
| 브러시 연속성 | UV 공간 스텝 보간 | 3D 캡슐 + 삼각형 탐색 |
| 공유 컴포넌트 | — | SurfacePickerComponent·CursorComponent·OrbitCamera 무수정 재사용 |

레거시로 남은 부분도 하나 있습니다. `erase_dirt.gdshader`(2D UV 스탬프 경로)와 그 `ShaderMaterial`은 씬과 코드에 여전히 남아있지만, 실제 분사 경로는 `erase_at_3d()`로 완전히 대체되었습니다. 정리하지 않고 남겨둔 흔적이라 두 프로젝트를 분리할 때 정리 대상입니다.

---

## 정리: 문제를 도구로 이해하기

이 프로젝트에서 얻은 가장 큰 교훈은 **임시 해결과 근본 해결을 구분하는 타이밍**이었습니다.

Method B(비율 판별)는 빠르게 95% 케이스를 막아줬지만, UV 공간에서 보간한다는 근본 구조는 손대지 않았습니다. 새 모델이나 특정 카메라 각도를 만나면 언제든 다시 터질 수 있었습니다. Method C를 설계할 때는 "왜 심 구간에서만 터지는가"를 처음부터 다시 생각했고, UV 보간이 UV 심을 물리적으로 인식하지 못한다는 것 — 그 보간 자체를 없애야 한다는 것을 파악하고 나서야 블렌더 방식이 보였습니다.

더 크게 보면, Painter 때 "당장 안 터지니 넘어간" 문제가 PowerWash에서는 핵심 과제가 되었습니다. 그리고 Painter를 만들며 미리 그어둔 컨트롤러/컴포넌트 경계 덕분에, 그 과제를 컨트롤러 전체를 다시 짜는 대신 `SurfacePickerComponent` 하나를 확장하는 것으로 풀 수 있었습니다. `void blit()`의 `return` 제한, FRAGCOORD vs UV 좌표 혼동 같은 함정들도 결국 에러 메시지 한 줄에서 원인을 찾고 구조를 바꾸는 과정이었습니다. **도구의 작동 원리를 이해하면 에러도 방향키가 됩니다.**

![SURFACE CLEAN! 클리어 화면](/images/powerwash/powerwash-clear.gif)
*진행도가 오르는 걸 지켜보다가 클리어 기준(평균 dirt 2% 이하)을 넘기는 순간 뜨는 클리어 오버레이.*

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `powerwash_controller.gd` | 입력 해석 · 컴포넌트 생성 및 조율 |
| `powerwash/components/dirt_canvas_component.gd` | dirt_mask/coverage_mask 소유 · `erase_at_3d` · 커버리지 빌드 |
| `powerwash/components/progress_component.gd` | GPU→CPU 리드백 · 커버리지 가중 진행도 · 클리어 판정 |
| `painter/components/surface_picker_component.gd` | 레이캐스트 · 베리센트릭 UV · 삼각형 탐색 (Painter와 공유) |
| `powerwash/shaders/erase_dirt_3d.gdshader` | 3D 역투영 erase 셰이더 (실사용 경로) |
| `powerwash/shaders/dirt_surface.gdshader` | PBR dirty/clean 혼합 렌더링 |
| `powerwash/shaders/init_dirt.gdshader` / `init_coverage.gdshader` | 초기 dirt 패턴 · 커버리지 마스크 굽기 (시작 시 1회) |

**이전 글**: [C# 애드온을 GDScript 컴포넌트로 — 3D 텍스처 페인터 재구성기](/projects/drawable-texture-painter/)

---

`#Godot4` `#GDScript` `#GLSL` `#게임플레이프로그래밍` `#GPU텍스처` `#포트폴리오`
