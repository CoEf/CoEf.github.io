import { defineCollection, z } from 'astro:content';

// devlog: 개발 기록 (진행 중인 작업, 아키텍처 노트, 트러블슈팅 등)
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    // 어떤 프로젝트에 속한 기록인지 (projects 슬러그와 연결, 선택)
    project: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// projects: 포트폴리오 프로젝트 (완성/진행 중인 결과물)
const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    status: z.enum(['in-progress', 'completed', 'archived']).default('in-progress'),
    stack: z.array(z.string()).default([]),
    role: z.string().optional(),
    startDate: z.date(),
    coverImage: z.string().optional(),
    links: z
      .object({
        repo: z.string().url().optional(),
        demo: z.string().url().optional(),
      })
      .optional(),
    order: z.number().default(0),
  }),
});

export const collections = { blog, projects };
