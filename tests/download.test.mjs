import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";
import { unzipSync } from "fflate";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generated = await mkdtemp(path.join(root, ".download-test-"));
try {
  for (const name of ["model", "download"]) {
    const source = await readFile(path.join(root, "src", name + ".ts"), "utf8");
    const output = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/(['"])\.\/model\1/g, '"./model.mjs"');
    await writeFile(path.join(generated, name + ".mjs"), output);
  }
  const { uniqueName, downloadZip } = await import(
    pathToFileURL(path.join(generated, "download.mjs"))
  );
  const used = new Set();
  assert.equal(
    uniqueName({ filename: "voice.wav", url: "/media/1.wav" }, used),
    "voice.wav",
  );
  assert.equal(
    uniqueName({ filename: "voice.wav", url: "/media/2.wav" }, used),
    "voice (2).wav",
  );
  assert(
    !uniqueName(
      { filename: "../bad/name.wav", url: "/media/3.wav" },
      used,
    ).includes("/"),
  );
  let captured;
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = (b) => {
    captured = b;
    return "blob:test";
  };
  globalThis.setTimeout = () => 0;
  globalThis.fetch = async (url) =>
    url.endsWith("missing")
      ? new Response("", { status: 404 })
      : new Response(new Uint8Array([1, 2, 3]));
  const assets = [
    { id: "1", filename: "voice.wav", url: "/1.wav" },
    { id: "2", filename: "voice.wav", url: "/2.wav" },
    { id: "3", filename: "lost.wav", url: "/missing" },
  ];
  const progress = [];
  const failed = await downloadZip(assets, "test", (s) => progress.push(s));
  assert.deepEqual(
    failed.map((a) => a.id),
    ["3"],
  );
  const result = unzipSync(new Uint8Array(await captured.arrayBuffer()));
  assert.deepEqual(Object.keys(result), ["voice.wav", "voice (2).wav"]);
  assert.deepEqual([...result["voice.wav"]], [1, 2, 3]);
  assert(progress.length >= 3);
  console.log(
    "PASS ZIP original bytes, duplicate names, unsafe filename sanitizing, partial failure reporting",
  );
} finally {
  if (!generated.startsWith(root + path.sep))
    throw Error("Unsafe cleanup path");
  await rm(generated, { recursive: true, force: true });
}
