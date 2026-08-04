import { DEFAULT_CHUNK_SIZE, hashExactFileChunks } from "./chunks";
import { buildMerkleRoot } from "./merkle";

/** Lean manifest: enough for edge→cloud verify without per-chunk hex bloat. */
export type MerkleResult = {
  chunkSize: number;
  chunkCount: number;
  merkleRoot: string;
};

export async function calculateFileMerkleRoot(
  filePath: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<MerkleResult> {
  const leafHashes = await hashExactFileChunks(filePath, chunkSize);
  const chunkCount = leafHashes.length;
  const root = buildMerkleRoot(leafHashes);

  return {
    chunkSize,
    chunkCount,
    merkleRoot: root.toString("hex"),
  };
}
