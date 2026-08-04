import { sha256Pair } from "./hash";

/**
 * Fold leaf hashes into a Merkle root in place.
 * Mutates `leafHashes` (callers must not need the leaves afterward).
 */
export function buildMerkleRoot(leafHashes: Buffer[]): Buffer {
  const length = leafHashes.length;
  if (length === 0) {
    throw new Error("Cannot build a Merkle root with no leaves.");
  }

  let levelSize = length;

  while (levelSize > 1) {
    let write = 0;

    for (let read = 0; read < levelSize; read += 2) {
      const left = leafHashes[read];
      const right = read + 1 < levelSize ? leafHashes[read + 1] : left;
      leafHashes[write] = sha256Pair(left, right);
      write += 1;
    }

    levelSize = write;
  }

  return leafHashes[0];
}
