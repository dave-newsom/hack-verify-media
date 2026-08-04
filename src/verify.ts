import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

import { DEFAULT_CHUNK_SIZE } from "./chunks";
import { calculateFileMerkleRoot } from "./fileMerkle";
import type { MerkleResult } from "./fileMerkle";

export function sidecarBase(filePath: string): string {
  const ext = extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

/**
 * Re-hash `filePath`, compare against `<base>-hash.md`, write `<base>-verified.md`.
 * Uses chunkSize from the sidecar when present so edge/cloud stay aligned.
 */
export async function verifyFile(filePath: string): Promise<MerkleResult> {
  const base = sidecarBase(filePath);
  const hashFilePath = `${base}-hash.md`;
  const verifiedFilePath = `${base}-verified.md`;

  const stored = JSON.parse(await readFile(hashFilePath, "utf8")) as MerkleResult;

  const chunkSize =
    typeof stored.chunkSize === "number" && stored.chunkSize > 0
      ? stored.chunkSize
      : DEFAULT_CHUNK_SIZE;

  const { merkleRoot } = await calculateFileMerkleRoot(filePath, chunkSize);
  const verified = merkleRoot === stored.merkleRoot;

  await writeFile(verifiedFilePath, verified ? "VERIFIED" : "VERIFY FAILED");

  return {
    verified,
    chunkSize: stored.chunkSize,
    chunkCount: stored.chunkCount,
    merkleRoot: stored.merkleRoot,
  };
}
