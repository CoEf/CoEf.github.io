---
title: "[템플릿] 트리 다이어그램 사용법"
date: 2026-07-15
summary: "언더스코어 파일이라 빌드에 포함되지 않음. 트리 다이어그램이 필요한 글에서 아래 HTML을 복사해서 쓰면 됨."
tags: []
category: "devlog"
draft: false
---

`_`로 시작하는 파일이라 Astro 콘텐츠 컬렉션에서 자동 제외됨 (페이지 생성 X, 목록에도 안 뜸).
스타일은 `PostLayout.astro` / `ProjectLayout.astro`의 `.tree` 관련 규칙에 이미 정의돼 있어서,
글 본문에는 아래 HTML만 그대로 복사해서 내용만 바꾸면 됨.

- 루트 노드: `.tree-root` 안에 `.tree-root-name`(이름), `.tree-root-file`(파일/부제, 생략 가능)
- 그룹 노드(자식이 있는 항목): `<li>` 안에 `.tree-node` 라벨 + `<ul>` 중첩
- 리프 노드(자식 없는 항목): `<li>` 안에 `<code>이름</code>` + `.tree-desc` 설명

```html
<div class="tree">
  <div class="tree-root">
    <span class="tree-root-name">Main <em>(Node3D)</em></span>
    <span class="tree-root-file">painter_controller.gd</span>
  </div>
  <ul>
    <li>
      <span class="tree-node">동적으로 생성되는 컴포넌트</span>
      <span class="tree-desc">_ready()에서 생성</span>
      <ul>
        <li><code>PaintCanvasComponent</code><span class="tree-desc">텍스처 3장 소유, 블릿 실행</span></li>
        <li><code>SurfacePickerComponent</code><span class="tree-desc">화면 좌표 → UV/3D 변환</span></li>
        <li><code>BrushComponent</code><span class="tree-desc">브러시·마스크·크기·불투명도</span></li>
        <li><code>CursorComponent</code><span class="tree-desc">3D 커서 표시</span></li>
        <li><code>PainterUIComponent</code><span class="tree-desc">UI 표시, 입력을 시그널로 보고</span></li>
      </ul>
    </li>
    <li><code>OrbitCamera</code><span class="tree-desc">API로만 구동</span></li>
    <li><code>Plushy</code><span class="tree-desc">칠할 대상 · ORMMaterial3D + Drawable×3</span></li>
    <li>
      <span class="tree-node">데이터 리소스</span>
      <ul>
        <li><code>BrushSet</code><span class="tree-desc">PBR 텍스처 5장 묶음</span></li>
        <li><code>BrushMask</code><span class="tree-desc">마스크 텍스처 + 원형 블렌드 여부</span></li>
      </ul>
    </li>
    <li><code>draw.gdshader</code><span class="tree-desc">texture_blit · 픽셀에 굽는 곳</span></li>
  </ul>
</div>
```

렌더링 결과:

<div class="tree">
  <div class="tree-root">
    <span class="tree-root-name">Main <em>(Node3D)</em></span>
    <span class="tree-root-file">painter_controller.gd</span>
  </div>
  <ul>
    <li>
      <span class="tree-node">동적으로 생성되는 컴포넌트</span>
      <span class="tree-desc">_ready()에서 생성</span>
      <ul>
        <li><code>PaintCanvasComponent</code><span class="tree-desc">텍스처 3장 소유, 블릿 실행</span></li>
        <li><code>SurfacePickerComponent</code><span class="tree-desc">화면 좌표 → UV/3D 변환</span></li>
        <li><code>BrushComponent</code><span class="tree-desc">브러시·마스크·크기·불투명도</span></li>
        <li><code>CursorComponent</code><span class="tree-desc">3D 커서 표시</span></li>
        <li><code>PainterUIComponent</code><span class="tree-desc">UI 표시, 입력을 시그널로 보고</span></li>
      </ul>
    </li>
    <li><code>OrbitCamera</code><span class="tree-desc">API로만 구동</span></li>
    <li><code>Plushy</code><span class="tree-desc">칠할 대상 · ORMMaterial3D + Drawable×3</span></li>
    <li>
      <span class="tree-node">데이터 리소스</span>
      <ul>
        <li><code>BrushSet</code><span class="tree-desc">PBR 텍스처 5장 묶음</span></li>
        <li><code>BrushMask</code><span class="tree-desc">마스크 텍스처 + 원형 블렌드 여부</span></li>
      </ul>
    </li>
    <li><code>draw.gdshader</code><span class="tree-desc">texture_blit · 픽셀에 굽는 곳</span></li>
  </ul>
</div>
