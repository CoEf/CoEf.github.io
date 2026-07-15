---
title: "3D 텍스처 페인터 — DrawableTexture2D C# 데모 포팅"
summary: "Godot 4.7 DrawableTexture2D 사용법을 익히려 C# 데모를 GDScript 컴포넌트 구조로 포팅한 기록. PowerWash Simulator의 전신 프로젝트."
status: "completed"
stack: ["Godot 4.7", "GDScript", "GLSL"]
role: "1인 개발"
startDate: 2026-06-01
coverImage: "/images/painter/painter-hero.png"
order: 0
---

# C# 애드온을 GDScript 컴포넌트로 — Godot 3D 텍스처 페인터 재구성기

> **개인 프로젝트 | Godot 4.7 · GDScript · GLSL | 2026.06**

![완성된 Painter UI](/images/painter/painter-hero.png)
*마우스로 인형 모델에 재질을 칠하는 완성된 Painter. 좌측은 albedo/normal/orm 텍스처 미리보기, 우측은 브러시·마스크 패널.*

---

## 시작: Godot 4.7의 DrawableTexture2D를 찾다가

Godot 4.7 변경 로그에서 `DrawableTexture2D`를 처음 봤습니다. GPU에 상주하는 텍스처를 셰이더로 직접 읽고 쓸 수 있게 해주는 클래스입니다. 실제 사용 예제를 찾아보다가 Rokojori가 만든 [drawable-textures-demo-c-sharp](https://github.com/Rokojori/drawable-textures-demo-c-sharp)라는 C# 데모 프로젝트를 발견했습니다. 마우스로 3D 모델 표면에 재질(색·노멀·거칠기)을 직접 칠하는 미니 PBR 페인터였고, 브러시·마스크·불투명도까지 갖춘 UI도 이미 붙어 있었습니다.

이 프로젝트는 그 C# 데모를 GDScript로 포팅한 것입니다. (원본 C# 프로젝트 자체도 BastiaanOlij의 최소 GDScript 데모를 C#으로 포팅하면서 멀티 브러시·마스크·UI·불투명도 기능을 확장한 것이니, 이 프로젝트까지 치면 3대째 이식인 셈입니다.) 원본은 `Main.cs` 하나에 727줄로 입력 처리·레이캐스트·텍스처 조작·UI 갱신이 전부 들어있는 구조였고, 포팅하면서 목표를 두 가지로 잡았습니다.

1. GDScript로 옮기면서 `DrawableTexture2D`를 실제로 얼마나 활용할 수 있는지 확인하는 것
2. 기능은 그대로 두고 코드 구조를 "컨트롤러는 언제, 컴포넌트는 어떻게" 원칙으로 재배치하는 것

아래에서는 이 두 축 — **포팅하며 이해한 동작 원리**와 **구조적으로 바꾼 부분** — 을 나눠서 짚겠습니다.

---

## 전체 구조 한눈에 보기

씬은 `main.tscn` 하나, 스크립트는 `painter_controller.gd` 하나만 씬에 미리 붙어 있습니다. 나머지는 전부 실행 시점에 코드로 생성됩니다.

```
Main (Node3D) — painter_controller.gd          ◀ 입력을 받고 "언제" 할지만 결정
│
├─ _ready()에서 동적으로 생성되는 컴포넌트
│   ├── PaintCanvasComponent     — 텍스처 3장(albedo/normal/orm) 소유, 실제 블릿 실행
│   ├── SurfacePickerComponent   — 화면 좌표 → UV / 3D 위치 변환
│   ├── BrushComponent           — 현재 브러시·마스크·크기·불투명도 상태
│   ├── CursorComponent          — 3D 커서 표시
│   └── PainterUIComponent       — 스와치·슬라이더·라벨 표시, 사용자 입력을 시그널로 보고
│
├── OrbitCamera                  — 궤도 카메라 (입력을 직접 읽지 않고 API로만 구동)
├── Plushy (칠할 대상 3D 모델)     — material_override: ORMMaterial3D + DrawableTexture2D × 3
│
├── 데이터 리소스
│   ├── BrushSet   — 브러시 1개 = PBR 텍스처 5장 묶음 (albedo/normal/ao/roughness/metallic)
│   └── BrushMask  — 마스크 1개 = 마스크 텍스처 + 원형 블렌드 여부
│
└── draw.gdshader (texture_blit 셰이더) — 브러시 스탬프를 실제로 픽셀에 굽는 곳
```

핵심 원칙은 하나입니다.

> **컨트롤러는 "언제" 칠할지만 결정하고, "어떻게" 칠할지는 컴포넌트가 안다.**

`painter_controller.gd`는 키보드·마우스 이벤트를 받아 해석만 하고, 실제 텍스처 조작은 `PaintCanvasComponent.paint_at()` 한 줄 호출로 넘깁니다. 컴포넌트끼리는 서로를 직접 참조하지 않고, 전부 시그널로만 연결됩니다 — 브러시 크기가 바뀌면 `BrushComponent`가 `size_changed` 시그널을 쏘고, 컨트롤러가 그걸 받아 `CursorComponent`와 `PainterUIComponent`에 다시 전달하는 식입니다. 컴포넌트 하나만 떼어내 다른 씬(실제로 PowerWash 씬)에 그대로 옮겨 써도 되는 이유가 여기 있습니다.

---

## 화면 클릭이 텍스처 좌표가 되기까지

가장 먼저 이해해야 했던 부분은 "마우스로 3D 모델을 클릭했을 때 그게 텍스처의 어느 픽셀인지" 어떻게 알아내느냐였습니다.

`SurfacePickerComponent`는 시작할 때 모델의 메쉬를 `TriangleMesh`로 한 번 구워둡니다.

```gdscript
func setup(plushy: MeshInstance3D) -> void:
    var surface: Array = plushy.mesh.surface_get_arrays(0)
    var vertices: PackedVector3Array = surface[Mesh.ARRAY_VERTEX]
    var tex_uvs: PackedVector2Array = surface[Mesh.ARRAY_TEX_UV]
    var indices: PackedInt32Array = surface[Mesh.ARRAY_INDEX]
    # ... 삼각형 단위로 정점/UV를 풀어서 저장
    _hit_mesh.create_from_faces(_faces)
```

마우스 클릭이 들어오면 카메라에서 레이를 쏘고, `TriangleMesh.intersect_ray()`로 어느 삼각형의 어느 지점에 맞았는지 얻습니다. 여기서 얻는 건 3D 위치일 뿐, UV가 아닙니다. UV로 바꾸려면 **베리센트릭 좌표**가 필요합니다.

```gdscript
# f = 레이가 맞은 3D 지점, p1/p2/p3 = 삼각형의 세 정점
var f1 := p1 - f
var f2 := p2 - f
var f3 := p3 - f

var a  := (p1 - p2).cross(p1 - p3).length()   # 전체 삼각형 넓이
var a1 := f2.cross(f3).length() / a           # p1 쪽 부분삼각형 넓이 비율
var a2 := f3.cross(f1).length() / a
var a3 := f1.cross(f2).length() / a

return _uvs[index] * a1 + _uvs[index + 1] * a2 + _uvs[index + 2] * a3
```

**왜 이렇게 했나**: 맞은 지점이 삼각형 안 어디쯤인지를 세 정점으로부터의 "상대적 거리 비율"로 나타낸 게 베리센트릭 좌표고, 정점마다 다른 UV 값을 이 비율로 섞으면 그 지점의 UV를 정확히 복원할 수 있습니다. 3D 좌표만으로는 텍스처의 어느 픽셀을 칠해야 할지 알 수 없기 때문에, 페인팅 도구라면 반드시 거쳐야 하는 변환입니다.

---

## 페인팅 실체: 텍스처 3장을 한 번에 블릿

UV를 얻고 나면 `PaintCanvasComponent.paint_at()`이 실제로 브러시를 찍습니다.

```gdscript
func paint_at(uv: Vector2, draw_size: float, brush: BrushSet) -> void:
    var ds: Vector2 = Vector2.ONE * draw_size
    var rect := Rect2(uv * Vector2(_texture_size) - ds * 0.5, ds)

    _albedo_texture.blit_rect_multi(
        rect,
        [brush.albedo_texture, brush.normal_texture],
        [_normal_texture, _orm_texture],
        Color(1.0, 1.0, 1.0, 1.0),
        0,
        _material
    )
```

`blit_rect_multi()` 한 번 호출로 `draw.gdshader`가 실행되면서 알베도·노멀·ORM(occlusion/roughness/metallic) 세 장을 **동시에** 갱신합니다.

```glsl
shader_type texture_blit;
render_mode blend_mix;

void blit() {
    vec2 uv = FRAGCOORD.xy / texture_size;
    // ... 마스크 회전/스케일 적용, 원형 falloff 계산

    COLOR0 = vec4(MODULATE.rgb * albedo_color.rgb, albedo_color.a * alpha);  // albedo
    COLOR1 = vec4(normal_color.rgb, alpha);                                   // normal
    COLOR2 = vec4(ao, roughness, metallic, alpha);                           // orm
}
```

이 구조는 원본 `Main.cs`의 `DrawAtOnePoint()`와 동일합니다 — `BlitRectMulti` 호출의 인자 순서까지 그대로 포팅했습니다.

```csharp
// 원본 Main.cs — DrawAtOnePoint()
albedo_texture.BlitRectMulti(
  (Rect2I) rect,
  [ brush.albedoTexture, brush.normalTexture ],
  [ normal_texture, orm_texture ],
  new Color(1.0f, 1.0f, 1.0f, 1.0f),
  0,
  draw_material
);
```

이 구조가 하는 일은 명확합니다. `blit_rect_multi()`는 소스 텍스처 여러 장(`hint_blit_source0`/`hint_blit_source1`)을 입력받아 셰이더 `blit()`를 한 번만 실행하고, 그 결과를 대상 텍스처 여러 장(`COLOR0`/`COLOR1`/`COLOR2`)에 동시에 씁니다. albedo·normal·orm 세 장은 항상 같은 좌표·같은 알파(`alpha`)로 갱신돼야 시각적으로 어긋나지 않는데, 이 API를 쓰면 UV 좌표 계산·마스크 샘플링·원형 falloff 계산을 셰이더에서 딱 한 번만 하고 그 결과를 세 출력에 나눠 쓸 수 있습니다.

물론 이 구조가 유일한 답은 아닙니다. 세 번 따로 `blit_rect()`를 호출하는 구조도 얼마든지 가능합니다. 다만 그렇게 나누면 UV·마스크 회전/스케일·falloff 계산을 셰이더 3개(또는 유니폼 분기 하나)에 중복시켜야 하고, 세 번의 draw call 사이에서 `alpha`가 프레임 간 미세하게 어긋날 여지도 생깁니다. 지금 구조는 "계산은 한 번, 출력만 세 갈래로 나눈다"는 점에서 합리적인 선택입니다.

아래 두 가지도 원본 그대로 포팅한 부분입니다.

- **마스크 랜덤 회전/오프셋** — 마우스 왼쪽 버튼을 누를 때마다 `BrushComponent.randomize_mask_transform()`이 마스크 셰이더 파라미터(`maskRotation`, `maskOffset`)를 무작위 값으로 다시 설정합니다. 원본 `_UnhandledInput()`에 있던 로직과 계산식이 동일합니다. 같은 마스크 텍스처를 반복 스탬프로 찍으면 항상 같은 회전·위치로 겹쳐 찍히면서 타일링 무늬가 도드라지는데, 스트로크(마우스 다운)마다 회전각과 오프셋을 다시 굴리면 그 반복 패턴이 깨집니다.
- **마스크 스케일 슬라이더의 로그/지수 매핑** — `mask_scale_to_normalized()`/`mask_scale_from_normalized()`는 원본 `MaskScaleFromNormalized()`/`MaskScaleToNormalized()`와 함수명·공식(`pow(mask_scale_max, lerp(-1, 1, normalized))`)까지 동일한 1:1 포팅입니다. 슬라이더 자체는 선형(0~1)이지만 마스크 스케일은 배율이기 때문에, 선형으로 매핑하면 슬라이더 앞쪽 절반에서 배율이 너무 급하게 움직이고 뒤쪽 절반은 둔감해집니다. 지수 매핑을 쓰면 슬라이더 중앙이 배율 1.0(원본 크기)이 되고, 좌우로 움직일 때 "절반/두 배" 같은 상대적 변화가 균등한 감각으로 느껴집니다.

![브러시·마스크를 바꿔가며 칠하는 모습](/images/painter/painter-mask-demo.gif)
*브러시와 마스크 몇 가지를 바꿔가며 칠하는 모습. 스트로크마다 마스크 회전/오프셋이 리롤되는 순간만 딱 집어 보여주는 영상은 아니지만, 반복 스탬프에도 무늬가 매번 다르게 찍히는 걸 확인할 수 있다.*

세 가지 모두 계산 로직은 원본을 그대로 포팅했고, 위 설명은 코드를 읽으며 이해한 동작 원리입니다.

---

## 재작성한 부분: 스트로크를 어떻게 잇는가 — 그리고 여기서 드러난 한계

마우스를 누른 채로 드래그하면 프레임마다 점 하나씩 찍는 게 아니라, 이전 프레임 위치와 지금 위치 사이를 이어서 칠해야 자연스럽습니다. 이 부분은 제가 직접 짠 로직입니다.

```gdscript
func paint_segment(from_uv: Vector2, to_uv: Vector2, steps_per_uv_unit: int,
                    draw_size: float, brush: BrushSet) -> void:
    var num_steps: int = int(max(1.0, (to_uv - from_uv).length() * steps_per_uv_unit))

    for i in range(num_steps):
        var t: float = (i + 1.0) / float(num_steps)
        var uv: Vector2 = from_uv.lerp(to_uv, t)
        paint_at(uv, draw_size, brush)
```

**왜 이렇게 했나**: 프레임 간 마우스 이동 거리가 브러시 크기보다 크면 스탬프 사이에 빈틈이 생깁니다. 그래서 이전 UV와 현재 UV 사이를 `steps_per_uv_unit` 밀도로 잘게 나눠 그 사이를 촘촘히 스탬프로 채웁니다. 두 점 사이를 UV 공간에서 그냥 선형 보간(`lerp`)한 것뿐이라 구현은 단순합니다.

문제는 여기 있습니다. **UV 공간에서의 직선 거리와 3D 표면에서의 실제 거리가 항상 일치하지는 않는다**는 점입니다. 텍스처를 펼칠 때 모델 표면은 여러 조각(UV 아일랜드)으로 잘려 있고, 그 경계(심, seam)를 넘나드는 스트로크는 UV 좌표상으로 텍스처 반대편으로 순간 이동한 것처럼 보일 수 있습니다. 이 프로젝트(Painter)에서는 이 문제를 구조적으로 해결하지 않았습니다 — 브러시가 크고 두 프레임 사이 이동량이 작은 일반적인 사용에서는 잘 드러나지 않았기 때문입니다.

![UV 심을 넘는 드래그가 엉뚱한 위치를 칠하는 모습](/images/painter/painter-uv-seam.gif)
*빠르게 드래그해 UV 아일랜드 경계를 넘으면, 중간 경로가 텍스처의 엉뚱한 영역을 스탬프로 찍는다.*

사실 이 한계는 저만 놓친 게 아니라 **원작자도 이미 알고 있었습니다.** 원본 저장소 README에 이렇게 쓰여 있습니다.

> Continous drawing is also supported as flag in the Main.cs script, but will fail when UV islands are crossed.

즉 연속 드로잉(지금의 `paint_segment`에 해당하는 `useContiniousDrawing` 플래그) 자체가 "UV 아일랜드를 넘으면 깨진다"는 걸 원작자가 이미 문서에 명시해둔 알려진 한계였습니다. 이 프로젝트에서는 그 알려진 한계를 그대로 물려받은 채 넘어간 것이고, 근본 해결은 하지 않았습니다.

이 한계는 이 프로젝트를 만들고 나서 두 번째 프로젝트인 **PowerWash Simulator**를 만들면서 정면으로 부딪혔습니다. 거기서는 진행도(%)를 정확히 계산해야 했기 때문에 심 경계를 넘는 드래그가 훨씬 자주, 훨씬 눈에 띄게 문제를 일으켰고, 결국 **UV 공간에서 보간하는 방식 자체를 버리고 3D 공간에서 삼각형별로 직접 블릿하는 방식(3D 역투영)**으로 다시 설계했습니다. 그 과정은 [UV 보간의 함정과 3D 역투영](/projects/blog_post_kr/)에 정리해 두었습니다.

즉 Painter의 이 단순한 `lerp` 한 줄은, 나중에 보면 "임시로 넘어간 문제"였던 셈입니다.

---

## 구조를 정리한 부분: 컨트롤러/컴포넌트 패턴

원본 애드온에서 제가 실제로 손을 댄 부분은 알고리즘보다 **구조**였습니다. 기능별로 파일을 쪼개고, 씬에는 아무것도 미리 배치하지 않은 채 컨트롤러가 실행 시점에 필요한 걸 만들도록 바꿨습니다.

```gdscript
func _ready() -> void:
    _canvas = _add_component(PaintCanvasComponent, "PaintCanvas")
    _picker = _add_component(SurfacePickerComponent, "SurfacePicker")
    _brush  = _add_component(BrushComponent, "Brush")
    _cursor_component = _add_component(CursorComponent, "Cursor")
    _ui = _add_component(PainterUIComponent, "UI")

    _canvas.setup(plushy, texture_size, draw_material)
    _picker.setup(plushy)
    _brush.setup(draw_material, brushes, masks, draw_size_min, draw_size_max, mask_scale_max)
    # ...
    _connect_brush_signals()
    _connect_ui_signals()

func _add_component(script: Script, node_name: String) -> Node:
    var instance: Node = script.new()
    instance.name = node_name
    add_child(instance)
    return instance
```

그리고 컴포넌트끼리는 절대 서로를 직접 호출하지 않고, 컨트롤러를 거쳐 시그널로만 이어집니다.

```gdscript
_brush.size_changed.connect(func(px: float) -> void:
    _cursor_component.set_scale_for_brush_size(px)
    _ui.refresh_size(px, draw_size_min, draw_size_max)
)
```

**왜 이렇게 정리했나**: 원본은 기능이 한 스크립트에 몰려 있어서, "브러시 크기를 바꾸는 코드"와 "UV를 구하는 코드"와 "UI 라벨을 갱신하는 코드"가 뒤섞여 있었습니다. 하나를 고치려면 관계없는 다른 로직까지 같이 읽어야 했습니다. 역할을 "언제(컨트롤러)"와 "어떻게(컴포넌트)"로 나누고 나니, 예를 들어 마스크 회전 로직에 버그가 있으면 `BrushComponent` 하나만 열어보면 됐고, 실제로 이 구조 덕분에 `SurfacePickerComponent`와 `CursorComponent`, 카메라 스크립트는 나중에 만든 PowerWash 씬에서 **코드 한 줄도 안 고치고 그대로 재사용**할 수 있었습니다.

---

## 원본과 나란히 놓고 보기: 실제로 무엇이 바뀌었나

"구조를 정리했다"는 말이 추상적으로 들릴 수 있어서, 원본 `Main.cs`와 나란히 놓고 구체적으로 어디가 어떻게 바뀌었는지 세 가지만 짚겠습니다.

**1. 스와치 생성 코드의 중복 제거**

원본은 브러시 스와치와 마스크 스와치를 만드는 함수가 따로 있는데, 텍스처 대입 대상만 다르고 내용은 거의 그대로 복사·붙여넣기 한 코드였습니다.

```csharp
// 원본 Main.cs — 두 함수가 24줄 중 20줄이 동일
void AddBrushSelector( BrushSet brushSet ) {
  var t = new TextureRect();
  t.Texture = brushSet.albedoTexture;
  t.Size = new Vector2( 24, 24 );
  // ... GuiInput 핸들러 등 완전히 같은 코드
}

void AddMaskSelector( BrushMask brushMask ) {
  var t = new TextureRect();
  t.Texture = brushMask.maskTexture;
  t.Size = new Vector2( 24, 24 );
  // ... 위와 완전히 같은 코드
}
```

새 버전은 스와치 생성 자체를 `_make_swatch()` 하나로 뽑아내고, `build_brush_swatches()`/`build_mask_swatches()`는 이 함수를 호출한 뒤 클릭 시그널만 다르게 연결합니다 (`painter_ui_component.gd`).

**2. "다 갱신" 대신 "바뀐 것만 갱신"**

원본은 브러시를 바꾸든, 크기를 바꾸든, 불투명도를 바꾸든 상관없이 매번 `UpdateBrushLabel()` 하나를 통째로 호출해서 라벨 5개·슬라이더 3개를 전부 다시 씁니다.

```csharp
// 원본 Main.cs — 예를 들어 마스크 스케일 하나만 바꿔도 이 전부가 다시 계산됨
void UpdateBrushLabel() {
  currentBrushLabel.Text = "Brush: " + brush.brushLabel;
  currentMaskLabel.Text = "Mask: " + mask.maskLabel;
  sizeLabel.Text = "Size: " + ...; sizeSlider.Value = ...;
  opacityLabel.Text = "Opacity: " + ...; opacitySlider.Value = ...;
  maskScaleLabel.Text = "Mask Scale: " + ...; maskScaleSlider.Value = ...;
}
```

새 버전은 `BrushComponent`가 `brush_changed`/`mask_changed`/`size_changed`/`opacity_changed`/`mask_scale_changed` 시그널을 각각 따로 쏘고, 컨트롤러가 그에 맞는 `_ui.refresh_size()`/`_ui.refresh_opacity()` 등 개별 함수만 호출합니다 (`painter_controller.gd`). 마스크 스케일만 바꿨는데 브러시 라벨까지 다시 쓰는 낭비가 없어졌습니다.

**3. 카메라가 입력을 스스로 읽지 않게 됨**

원본 `OrbitCamera.cs`는 카메라 스크립트 자신이 `_UnhandledInput()`을 구현해서 마우스 오른쪽 드래그·휠 입력을 직접 읽었습니다. 새 버전의 `orbit_camera.gd`에는 `_unhandled_input`이 아예 없습니다 — 대신 `add_yaw_pitch()`/`pan()`/`zoom()` API만 노출하고, 입력 해석은 전부 `painter_controller.gd`가 가져갔습니다. "컴포넌트는 입력을 읽지 않는다"는 원칙을 카메라에도 그대로 적용한 셈입니다.

세 가지 모두 계산 로직 자체는 원본과 동일합니다 — 달라진 건 "누가 언제 호출하는가"뿐입니다.

---

## 정리: 포팅에서 진짜 설계한 부분은 경계선이었다

이 포팅에서 실제로 "설계"한 부분은 알고리즘이 아니라 **경계선**이었습니다. 어디까지가 "언제"이고 어디부터가 "어떻게"인지 나누는 일, 그리고 어떤 코드는 원본 그대로 옮기고 어떤 코드는 구조를 바꿀지 판단하는 일이었습니다.

UV lerp 문제처럼 "당장 안 터지니 넘어간" 부분은 다음 프로젝트에서 결국 다시 마주쳤고, 그때는 이미 컴포넌트 단위로 나눠둔 구조 덕분에 `SurfacePickerComponent` 하나만 확장해서 해결할 수 있었습니다. 이 한계는 원작자도 README에 스스로 적어둘 만큼 이미 알려진 문제였습니다 — 새로 발견한 버그가 아니라 물려받은 숙제였던 셈이고, 두 번째 프로젝트에서 근본적으로 해결했습니다. 3장 동시 블릿·마스크 랜덤 오프셋·로그 매핑 슬라이더처럼 계산 로직 자체는 원본 그대로 포팅한 부분은, 동작 원리를 이해한 대로 설명하되 원저자가 실제로 어떤 의도였는지까지는 재구성하지 않고 남겨뒀습니다.

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `painter_controller.gd` | 입력 해석 · 컴포넌트 생성 및 조율 |
| `painter/components/paint_canvas_component.gd` | DrawableTexture2D 3장 소유 · `paint_at`/`paint_segment` |
| `painter/components/surface_picker_component.gd` | 레이캐스트 · 베리센트릭 UV 변환 (PowerWash와 공유) |
| `painter/components/brush_component.gd` | 브러시/마스크 상태 · 셰이더 파라미터 동기화 |
| `painter/components/painter_ui_component.gd` | 스와치/슬라이더 표시 · 사용자 입력 시그널화 |
| `draw.gdshader` | `texture_blit` 셰이더 — albedo/normal/orm 동시 출력 |
| `brush_set.gd` / `brush_mask.gd` | 브러시/마스크 데이터 리소스 정의 |

**원본**: [Rokojori/drawable-textures-demo-c-sharp](https://github.com/Rokojori/drawable-textures-demo-c-sharp) (`Main.cs`, `OrbitCamera.cs`, `draw.gdshader`)

---

`#Godot4` `#GDScript` `#GLSL` `#코드리딩` `#리팩터링` `#포트폴리오`
