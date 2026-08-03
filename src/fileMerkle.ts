import { DEFAULT_CHUNK_SIZE, hashExactFileChunks } from "./chunks";
import { buildMerkleRoot } from "./merkle";

export type MerkleResult = {
  chunkSize: number;
  chunkCount: number;
  chunkHashes: string[];
  merkleRoot: string;
};

export async function calculateFileMerkleRoot(
  filePath: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<MerkleResult> {
  const chunkHashes = await hashExactFileChunks(filePath, chunkSize);
  const merkleRoot = buildMerkleRoot(chunkHashes);

  return {
    chunkSize,
    chunkCount: chunkHashes.length,
    chunkHashes: chunkHashes.map((hash) => hash.toString("hex")),
    merkleRoot: merkleRoot.toString("hex"),
  };
}
