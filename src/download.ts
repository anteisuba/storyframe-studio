import { zip } from "fflate";
import { type Asset, titleOf } from "./model";
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function uniqueName(a: Asset, used: Set<string>) {
  let name = (
    a.filename ||
    a.originalPath?.split("/").pop() ||
    titleOf(a)
  ).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  const ext = a.url.split("?")[0].match(/\.[a-z0-9]+$/i)?.[0] || "";
  if (ext && !name.toLowerCase().endsWith(ext.toLowerCase())) name += ext;
  if (!name || name === "." || name === "..") name = "asset" + ext;
  const dot = name.lastIndexOf("."),
    stem = dot > 0 ? name.slice(0, dot) : name,
    suffix = dot > 0 ? name.slice(dot) : "";
  let candidate = name,
    n = 2;
  while (used.has(candidate.toLowerCase()))
    candidate = `${stem} (${n++})${suffix}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
export async function downloadZip(
  assets: Asset[],
  label: string,
  progress: (s: string) => void,
) {
  const files: Record<string, Uint8Array> = Object.create(null);
  const used = new Set<string>();
  const failed: Asset[] = [];
  let total = 0;
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    progress(`准备下载 ${i + 1}/${assets.length} · ${titleOf(a)}`);
    try {
      const r = await fetch(a.url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw Error("下载失败");
      if (
        total + Number(r.headers.get("Content-Length") || 0) >
        512 * 1024 * 1024
      )
        throw Error("超出打包限制");
      const data = new Uint8Array(await r.arrayBuffer());
      if (total + data.byteLength > 512 * 1024 * 1024)
        throw Error("超出打包限制");
      total += data.byteLength;
      files[uniqueName(a, used)] = data;
    } catch {
      failed.push(a);
    }
  }
  if (Object.keys(files).length) {
    progress("正在打包 ZIP…");
    const output = await new Promise<Uint8Array>((resolve, reject) =>
      zip(files, { level: 0 }, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
    );
    saveBlob(
      new Blob([new Uint8Array(output)], { type: "application/zip" }),
      label.replace(/[<>:"/\\|?*]/g, "_") + ".zip",
    );
  }
  return failed;
}
