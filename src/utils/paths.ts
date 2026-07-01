/** import.meta.env.BASE_URL이 trailing slash를 갖도록 정규화합니다. */
export function getBase(): string {
  const raw = import.meta.env.BASE_URL;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** base 기준으로 경로를 안전하게 이어붙입니다. 앞의 '/'는 제거하고 이어붙입니다. */
export function withBase(path: string): string {
  const base = getBase();
  return `${base}${path.replace(/^\/+/, '')}`;
}
