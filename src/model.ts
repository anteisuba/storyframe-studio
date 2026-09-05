export type Asset = {
  id: string;
  title?: string;
  name?: string;
  kind: string;
  url: string;
  filename?: string;
  originalPath?: string;
  category?: string;
  status?: string;
  blocked?: boolean;
  prompt?: string;
  character?: string;
  source?: string;
  analysis?: string;
  segment?: string;
  bytes?: number;
  width?: number;
  height?: number;
  shots?: number[];
};
export type Job = {
  id: string;
  prompt: string;
  camera?: string;
  performance?: string;
  audio?: string;
  endState?: string;
  seconds?: number;
};
export type Shot = {
  heroAssetId?: string;
  shot: number;
  title: string;
  visual?: string;
  audio?: string;
  set?: string;
  suggestedDuration?: number;
  assetIds: string[];
  config: {
    reviewStatus?: string;
    ratio?: string;
    resolution?: string;
    model?: string;
    jobs: Job[];
  };
};
export type Project = {
  id: string;
  title: string;
  description: string;
  revision: number;
  shots: Shot[];
  assets: Asset[];
  notes: string;
};
export const categories = [
  ["overview", "项目概览", "◫"],
  ["character", "角色与机甲", "♙"],
  ["scene", "场景参考", "▧"],
  ["shot-image", "镜头图", "▣"],
  ["story", "分镜工作稿", "☷"],
  ["video", "视频片段", "▷"],
  ["frame", "视频截帧", "▤"],
  ["audio", "音频", "♫"],
  ["analysis", "视频分析与来源", "⌕"],
  ["seedance", "Seedance 控制", "☷"],
  ["notes", "制作记录", "≡"],
] as const;
export type Section = (typeof categories)[number][0];
export const assetCategories = categories.filter(([id]) =>
  ["character", "scene", "shot-image", "video", "frame", "audio"].includes(id),
);
export function categoryOf(a: Asset): string {
  if (a.kind === "reference-image")
    return a.category === "场景" ? "scene" : "character";
  if (a.kind === "scene-image") return "scene";
  return a.kind;
}
export const titleOf = (a: Asset) =>
  a.title ||
  a.name ||
  a.filename ||
  a.originalPath?.split("/").pop() ||
  "未命名素材";
export const categoryLabel = (a: Asset) =>
  categories.find(([id]) => id === categoryOf(a))?.[1] || "参考素材";
export const isVideo = (a: Asset) => a.kind === "video";
export const isAudio = (a: Asset) => a.kind === "audio";
export const sizeLabel = (bytes = 0) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options);
  const value = await r.json();
  if (!r.ok) throw Error(value.error || "请求失败");
  return value;
}
