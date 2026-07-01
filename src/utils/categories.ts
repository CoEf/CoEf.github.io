export type Category = 'devlog' | 'godot-notes' | 'shader' | 'blender';

interface CategoryMeta {
  label: string;
  /** global.css에 정의된 CSS 변수 이름 (색상) */
  colorVar: string;
  /** 배경/음영용 옅은 버전 변수 이름 */
  dimVar: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  devlog: { label: 'Devlog', colorVar: '--signal', dimVar: '--signal-dim' },
  'godot-notes': { label: 'Godot 노트', colorVar: '--violet', dimVar: '--violet-dim' },
  shader: { label: 'Shader', colorVar: '--warn', dimVar: '--warn-dim' },
  blender: { label: 'Blender', colorVar: '--orange', dimVar: '--orange-dim' },
};

export const CATEGORY_LIST = Object.keys(CATEGORIES) as Category[];
