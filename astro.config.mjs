import { defineConfig } from "astro/config";

// ──────────────────────────────────────────────────────────
// GitHub Pages 배포 설정
// 1) 레포 이름이 "사용자명.github.io" 형태라면:
//    site: 'https://사용자명.github.io'
//    base: '/'
// 2) 레포 이름이 그 외(예: "devlog")라면:
//    site: 'https://사용자명.github.io'
//    base: '/devlog'
// 아래 값을 본인 것으로 바꿔주세요.
// ──────────────────────────────────────────────────────────
export default defineConfig({
  site: "https://CoEf.github.io",
  base: "/",
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      wrap: true,
    },
  },
});
