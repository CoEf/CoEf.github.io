---
title: "PowerWash Simulator - with DrawableTexture2D"
summary: ""
status: "completed"   # in-progress | completed | archived
stack: ["Godot 4", "GDScript"]
role: "1인 개발"
startDate: 2026-06-19
order: 1                 # 목록 정렬 순서, 낮을수록 먼저
links:
  repo: ""   # 선택
  demo: ""               # 선택
---


# UV 보간의 함정과 3D 역투영 — Godot 4.7로 PowerWash Simulator 구현하기

> **개인 프로젝트 | Godot 4.7 · GDScript · GLSL | 2026.06**

---

## 시작: DrawableTexture2D를 발견하다

Godot 4.7 변경 로그를 훑다가 `DrawableTexture2D`라는 항목을 발견했습니다.

"GPU 메모리에 상주하는 텍스처를 셰이더로 직접 읽고 쓸 수 있는 클래스"라는 설명이 눈에 들어왔습니다. 기존 페인터 애드온 코드를 역방향으로 활용하면 — 색을 **더하는** 게 아니라 dirt를 **지우는** 방향으로 — PowerWash Simulator를 만들 수 있겠다는 아이디어가 바로 떠올랐습니다.

단순한 클론 게임이 아니라 **GPU 텍스처 파이프라인과 3D→UV 변환을 직접 설계하는 기술적 챌린지**로 접근하기로 했습니다.

---

## 기본 아이디어: 역방향 페인팅

아이디어는 단순합니다.

| | 3D 페인터 (일반) | PowerWash |
|---|---|---|
| 텍스처 초기 상태 | R=0 (빈 캔버스) | R=1 (전체 더러움) |
| 브러시 동작 | R 증가 → 색 추가 | R 감소 → dirt 제거 |
| 진행도 | "얼마나 그렸나" | "얼마나 닦았나" |

`DrawableTexture2D`로 관리하는 `dirt_mask` 텍스처의 R값이 `1.0`이면 완전히 더럽고, `0.0`이면 깨끗합니다. `dirt_surface.gdshader`가 매 프레임 이 값을 읽어 3D 모델 표면 색을 결정합니다.

```glsl
// dirt_surface.gdshader — spatial 셰이더
void fragment() {
    float dirt = texture(dirt_mask, UV).r;  // 0=깨끗, 1=더러움
    ALBEDO = mix(
        texture(clean_albedo, UV).rgb,  // 깨끗한 원래 색
        dirt_color,                      // 갈색 오염 색
        dirt                             // 이 비율로 섞기
    );
    ROUGHNESS = mix(texture(clean_roughness, UV).r, dirt_roughness, dirt);
}
```

분사 버튼을 누르면 `texture_blit` 셰이더가 `dirt_mask`의 해당 픽셀 R값을 줄입니다. `blend_mix` 모드의 공식 덕분에, `COLOR0 = vec4(0, 0, 0, erase_strength)` 한 줄이면 충분합니다.

```
blend_mix 공식: result = src.rgb × src.a + dst.rgb × (1 - src.a)
                       = (0) × strength + dirt × (1 - strength)
                       = dirt × (1 - strength)   // dirt가 줄어든다
```

---

## 첫 번째 구현, 그리고 UV 심의 함정

첫 구현은 단순했습니다. `InputEvent`로 마우스 드래그를 감지하고, 매 프레임 레이캐스트로 UV 좌표를 얻어 이전 프레임 UV → 현재 UV 사이를 선형 보간하며 스탬프를 찍는 방식이었습니다.

테스트를 돌리자마자 이상한 현상이 나타났습니다. 인형 모델의 특정 부위를 드래그하면 **전혀 다른 위치가 지워지는** 것이었습니다.

### 원인 분석

UV 아틀라스를 펼쳐보니 바로 보였습니다. UV 심(Seam) 구간이었습니다.

```
3D 공간:  모델 오른쪽 어깨 표면을 좌 → 우로 드래그
UV 공간:  UV_A = (0.98, 0.42)  →  UV_B = (0.02, 0.42)
          [텍스처 오른쪽 끝]       [텍스처 왼쪽 끝]

lerp(UV_A, UV_B, t):
  t=0.0 → (0.98, 0.42) ✓
  t=0.5 → (0.50, 0.42) ← 텍스처 중앙, 실제로는 엉뚱한 위치!
  t=1.0 → (0.02, 0.42) ✓
```

3D 공간에서는 연속된 표면이지만, UV 공간에서는 텍스처 왼쪽 끝과 오른쪽 끝으로 분리되어 있습니다. 두 UV 좌표 사이를 단순 보간하면 중간 경로가 텍스처의 엉뚱한 영역을 통과하게 됩니다.

### Method B: 임시 방어

빠른 픽스로 **3D/UV 이동량 비율 판별**을 도입했습니다.

```gdscript
var uv_delta   := current_uv.distance_to(_last_uv)
var world_delta := current_world.distance_to(_last_world_pos)
var uv_per_world := uv_delta / max(world_delta, 0.001)

if uv_per_world > SEAM_THRESHOLD:
    # UV 심 구간으로 판단 — 현재 프레임 스킵
    _last_uv    = current_uv
    _last_world = current_world
    return
```

UV 심을 건너는 순간 uv_per_world 값이 폭등한다는 점을 이용한 방법입니다. 테스트 모델에서는 95% 케이스를 막아줬지만, 구조적 문제는 그대로였습니다.

> **"UV 공간에서 보간한다"는 전제 자체가 틀렸다.**

모델마다 심의 위치가 다르고, 카메라 각도나 드래그 속도에 따라 임계값을 계속 튜닝해야 했습니다. 언제든 다시 터질 수 있는 시한폭탄이었습니다.

---

## Method C: 3D 역투영으로 UV 보간 자체를 제거하다

블렌더가 3D 페인팅을 어떻게 구현하는지 찾아봤습니다. 블렌더는 UV 공간에서 선을 긋지 않습니다. **3D 공간의 브러시가 닿는 삼각형마다 해당 UV 영역에 직접 blit**합니다. UV 보간이 없으면 UV 심 문제도 없습니다.

### 알고리즘 전체 흐름

```
LMB 드래그 (world_from → world_to)
    │
    ▼
캡슐 범위 내 삼각형 목록 수집
get_triangles_in_capsule(world_from, world_to, brush_radius)
    │
    ▼
각 삼각형에 대해:
    1. UV 바운딩 박스 계산 → blit rect
    2. tri_uv0/1/2, tri_pos0/1/2 uniform 설정
    3. dirt_mask.blit_rect_multi(rect, ..., erase_3d_material)
            │
            └── GPU에서 erase_dirt_3d.gdshader 실행
                blit() 함수가 픽셀마다:
                  FRAGCOORD → 전체 UV
                  → 베리센트릭 좌표
                  → 3D 위치 복원
                  → 캡슐까지 거리
                  → erase_strength 출력
```

### 핵심 셰이더: erase_dirt_3d.gdshader

```glsl
shader_type texture_blit;
render_mode blend_mix;

uniform vec2 tri_uv0; uniform vec2 tri_uv1; uniform vec2 tri_uv2;
uniform vec3 tri_pos0; uniform vec3 tri_pos1; uniform vec3 tri_pos2;
uniform vec3 brush_a; uniform vec3 brush_b;
uniform float brush_radius = 0.05;
uniform float pressure : hint_range(0.0, 1.0) = 1.0;
uniform vec2 texture_size = vec2(1024.0, 1024.0);

const float EDGE_EPS = 0.01;  // 삼각형 경계 1px 여유

void blit() {
    // UV가 아닌 FRAGCOORD — blit rect 내부 상대 좌표가 아닌 전체 텍스처 기준 좌표
    vec2 uv = FRAGCOORD.xy / texture_size;

    vec3 bary;
    bool valid = barycentric(uv, bary);  // UV → 베리센트릭 좌표
    bool inside = valid
        && bary.x >= -EDGE_EPS
        && bary.y >= -EDGE_EPS
        && bary.z >= -EDGE_EPS;

    float erase_strength = 0.0;
    if (inside) {
        // 베리센트릭 좌표로 3D 위치 복원
        vec3 local_pos = tri_pos0 * bary.x + tri_pos1 * bary.y + tri_pos2 * bary.z;
        float dist = dist_to_segment(local_pos, brush_a, brush_b);
        float falloff = 1.0 - smoothstep(brush_radius * 0.3, brush_radius, dist);
        erase_strength = falloff * pressure;
    }

    // 삼각형 외부(alpha=0)는 기존 픽셀 그대로 — 인접 UV 섬 절대 침범하지 않음
    COLOR0 = vec4(0.0, 0.0, 0.0, erase_strength);
}
```

이 방식의 핵심은 **삼각형마다 독립적으로 blit**한다는 점입니다. UV 심 양쪽 삼각형은 서로 다른 UV 영역에 blit되고, 두 영역 사이에는 아무런 보간이 일어나지 않습니다. 심 아티팩트가 구조적으로 불가능한 방식입니다.

### texture_blit 셰이더에서 마주친 함정

구현 중 에러 하나가 바로 나왔습니다:

```
Error at line 65: Using 'return' in the 'blit' processor function is incorrect.
```

`texture_blit` 셰이더의 `void blit()`은 `return`문 자체가 문법 오류입니다. 원래 코드에는 "삼각형 밖이면 조기 return"이 있었는데, 이걸 `if (inside)` 분기로 재구성해야 했습니다. `erase_strength = 0.0` 초기값을 두고 삼각형 안쪽일 때만 값을 계산하는 구조입니다.

### 브러시 연속성: 캡슐 접근

빠른 드래그 시 프레임 간 브러시 스탬프 사이에 빈 구간이 생기는 문제도 있었습니다. "이전 위치 → 현재 위치"를 **캡슐(segment + radius)**로 표현하고, 그 캡슐과 교차하는 모든 삼각형을 한 번에 처리하는 방식으로 해결했습니다.

```gdscript
# surface_picker_component.gd
func get_triangles_in_capsule(world_a: Vector3, world_b: Vector3,
                               radius: float) -> Array[Dictionary]:
    var result: Array[Dictionary] = []
    # 세그먼트를 따라 일정 간격으로 샘플링해 캡슐 전체를 커버
    var step_count := max(1, int(world_a.distance_to(world_b) / (radius * 0.5)))
    for i in range(step_count + 1):
        var t := float(i) / float(step_count)
        var probe := world_a.lerp(world_b, t)
        _collect_nearby_triangles(probe, radius, result)
    return result
```

---

## 두 번째 문제: clean % 수치가 맞지 않는다

3D 역투영으로 심 문제를 해결하고 나서 다음 문제가 나타났습니다. 눈에 보이는 dirt를 80% 정도 닦았는데 progress bar는 50%를 가리키는 것이었습니다.

### 원인

UV 아틀라스에는 **어떤 삼각형도 매핑되지 않는 빈 공간**이 있습니다. `dirt_mask` 초기 상태가 solid white(R=1.0)이므로, 이 빈 공간도 전부 "더러움"으로 계산에 포함됩니다.

```
dirty_pixels / total_pixels = 실제 표면 80% + 빈 UV 공간 100%
                             ≠ 시각적으로 느끼는 청소량
```

### UV 커버리지 마스크

해결책은 **어떤 픽셀이 실제 삼각형인지 미리 마킹**하는 것입니다. 게임 시작 시 모든 삼각형을 별도 `coverage_mask` 텍스처에 래스터라이즈하고, 진행도 계산 시 이 마스크 R=1인 픽셀만 분모에 포함합니다.

```gdscript
# progress_component.gd — GPU→CPU readback 후 커버리지 가중 계산
func _sample() -> float:
    var img_dirt := _dirt_mask.get_image()
    var img_cov  := _coverage_mask.get_image()
    img_dirt = img_dirt.duplicate()
    img_dirt.resize(SAMPLE_RES, SAMPLE_RES)
    img_cov  = img_cov.duplicate()
    img_cov.resize(SAMPLE_RES, SAMPLE_RES)

    var covered := 0.0
    var dirty   := 0.0
    for y in SAMPLE_RES:
        for x in SAMPLE_RES:
            var c := img_cov.get_pixel(x, y).r   # 1 = 삼각형 있음
            covered += c
            dirty   += img_dirt.get_pixel(x, y).r * c
    return dirty / maxf(covered, 1.0)   # 빈 UV 공간 완전 제외
```

커버리지 마스크 빌드는 게임 시작 시 딱 한 번, `init_coverage.gdshader`로 모든 삼각형을 순회해 blit합니다. 런타임 비용은 진행도 샘플링뿐이고, GPU readback을 32×32로 다운샘플해 성능 부담을 최소화했습니다.

---

## 아키텍처: 컨트롤러는 "언제", 컴포넌트는 "어떻게"

기능이 늘어날수록 하나의 스크립트에 입력·3D 변환·텍스처 수정·진행도 추적이 뒤섞이기 시작했습니다. 이 시점에 컴포넌트 패턴으로 구조를 정리했습니다.

```
PowerWashController (언제)
    ├── DirtCanvasComponent  — DrawableTexture2D 소유 · erase_at_3d · 커버리지 빌드
    ├── SurfacePickerComponent — 레이캐스트 · 베리센트릭 UV · 삼각형 탐색
    └── ProgressComponent    — GPU readback · 커버리지 가중 평균 · 클리어 판정
```

컴포넌트는 씬에 미리 배치하지 않고 `_ready()`에서 동적으로 생성합니다.

```gdscript
func _ready() -> void:
    _canvas   = _add_component(DirtCanvasComponent,   "DirtCanvas")
    _picker   = _add_component(SurfacePickerComponent, "SurfacePicker")
    _progress = _add_component(ProgressComponent,      "Progress")

    # 커버리지 마스크를 한 번만 빌드
    _uv_to_world_scale = _picker.get_uv_to_world_scale()
    _canvas.build_coverage(_picker.get_all_triangles())
    _progress.set_coverage_mask(_canvas.get_coverage_mask())

    _progress.progress_updated.connect(_on_progress_updated)
    _progress.level_cleared.connect(_on_level_cleared)
```

컨트롤러는 입력을 받아 컴포넌트를 호출합니다. 컴포넌트는 입력을 읽지 않고 서로를 직접 참조하지 않습니다. 시그널로만 연결되어 있어 어느 씬에서든 동일한 컴포넌트를 재사용할 수 있습니다. 실제로 `SurfacePickerComponent`는 Painter 씬과 PowerWash 씬에서 동일한 코드로 돌아갑니다.

---

## 정리: 문제를 도구로 이해하기

이 프로젝트에서 얻은 가장 큰 교훈은 **임시 해결과 근본 해결을 구분하는 타이밍**이었습니다.

Method B(비율 판별)는 빠르게 95% 케이스를 막아줬지만, UV 공간에서 보간한다는 근본 구조는 손대지 않았습니다. 새 모델이나 특정 카메라 각도를 만나면 언제든 다시 터질 수 있었습니다.

Method C를 설계할 때는 "왜 심 구간에서만 터지는가"를 처음부터 다시 생각했습니다. UV 보간이 UV 심을 물리적으로 인식하지 못한다는 것, 그 보간 자체를 없애야 한다는 것을 파악하고 나서야 블렌더 방식이 보였습니다.

`void blit()`의 `return` 제한, FRAGCOORD vs UV 좌표 혼동, `blit_rect_multi` C++ assert 크래시 — 어느 것이든 에러 메시지 한 줄에서 원인을 찾고 구조를 바꾸는 과정이었습니다. **도구의 작동 원리를 이해하면 에러도 방향키가 됩니다.**

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `powerwash_controller.gd` | 게임 루프 · 입력 · 컴포넌트 조율 |
| `powerwash/components/dirt_canvas_component.gd` | erase_at_3d · 커버리지 빌드 |
| `painter/components/surface_picker_component.gd` | 레이캐스트 · 삼각형 탐색 |
| `powerwash/shaders/erase_dirt_3d.gdshader` | 3D 역투영 erase 셰이더 |
| `powerwash/shaders/dirt_surface.gdshader` | PBR dirty/clean 혼합 렌더링 |
| `powerwash/components/progress_component.gd` | GPU readback · 커버리지 가중 진행도 |

---

`#Godot4` `#GDScript` `#GLSL` `#게임플레이프로그래밍` `#GPU텍스처` `#포트폴리오`
