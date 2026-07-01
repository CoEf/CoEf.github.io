# devlog-blog

Astro로 만든 포트폴리오 + 개발 기록(devlog) 블로그입니다.
GitHub Pages에 GitHub Actions로 자동 배포되도록 구성되어 있습니다.

## 디자인 컨셉

Godot의 노드 그래프 / 시그널 와이어를 시각 언어로 차용했습니다.
- devlog 목록: 시그널 라인을 따라 이어지는 노드 타임라인
- 프로젝트 카드: 입출력 핀이 달린 컴포넌트 노드 형태
- 색상: 다크 그래파이트 배경 + 티얼(연결됨) / 앰버(진행중) 시그널 컬러

## 1. 로컬에서 실행하기

```bash
npm install
npm run dev
```

`http://localhost:4321` 에서 확인할 수 있습니다.

## 2. 배포 전 설정 (필수)

`astro.config.mjs`에서 본인의 GitHub 계정/레포 이름으로 바꿔주세요.

```js
export default defineConfig({
  site: 'https://사용자명.github.io',
  // 레포 이름이 "사용자명.github.io" 라면 base: '/'
  // 그 외 이름(예: "devlog")이라면 base: '/devlog'
  base: '/레포-이름',
});
```

## 3. GitHub에 올리고 Pages 켜기

```bash
git init
git add .
git commit -m "init: devlog blog"
git branch -M main
git remote add origin https://github.com/사용자명/레포-이름.git
git push -u origin main
```

그 다음 GitHub 레포 페이지에서:

1. **Settings → Pages**
2. **Build and deployment → Source**를 **"GitHub Actions"**로 선택

`main` 브랜치에 push할 때마다 `.github/workflows/deploy.yml`이 자동으로
빌드하고 배포합니다. (Actions 탭에서 진행 상황 확인 가능)

## 4. 글 쓰는 법

### Devlog 글 추가

`src/content/blog/` 아래 새 `.md` 파일을 만드세요.

```md
---
title: "글 제목"
date: 2026-07-01
summary: "한두 문장 요약"
tags: ["inventory", "refactor"]
project: "farming-inventory-system"   # 선택, projects 슬러그와 연결
draft: false                           # true면 빌드에서 제외
---

본문은 마크다운으로 자유롭게 작성합니다.
```

### 프로젝트 추가

`src/content/projects/` 아래 새 `.md` 파일을 만드세요.

```md
---
title: "프로젝트 이름"
summary: "한두 문장 요약"
status: "in-progress"   # in-progress | completed | archived
stack: ["Godot 4", "GDScript"]
role: "1인 개발"
startDate: 2026-01-01
order: 1                 # 목록 정렬 순서, 낮을수록 먼저
links:
  repo: "https://github.com/..."   # 선택
  demo: "https://..."               # 선택
---

본문 내용
```

## 5. 폴더 구조

```
src/
  content/
    blog/          ← devlog 글 (.md)
    projects/      ← 프로젝트 글 (.md)
    config.ts       ← 콘텐츠 스키마 (frontmatter 필드 정의)
  layouts/
    BaseLayout.astro     ← 공통 뼈대 (헤더/푸터/head)
    PostLayout.astro     ← devlog 상세 페이지 레이아웃
    ProjectLayout.astro  ← 프로젝트 상세 페이지 레이아웃
  components/       ← Header, Footer, ProjectCard, DevlogEntry
  pages/            ← 실제 라우트 (index, blog/, projects/)
  styles/global.css ← 디자인 토큰(색상/폰트) 전부 여기 있음
  utils/paths.ts    ← base 경로 헬퍼 (GitHub Pages 서브패스 대응)
```

색상이나 폰트를 바꾸고 싶으면 `src/styles/global.css` 상단의
`:root` 변수만 수정하면 전체에 반영됩니다.
