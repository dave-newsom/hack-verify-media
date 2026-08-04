import { readFileSync } from "node:fs";

import type { MerkleResult } from "./fileMerkle";

export type VerificationResult = {
  matched: boolean;
  expectedMerkleRoot: string;
  actualMerkleRoot: string;
  chunkSizeMatched: boolean;
  chunkCountMatched: boolean;
  changedChunkIndices: number[];
  unchangedChunkIndices: number[];
};

/** Load and validate an expected-Merkle JSON file (as produced by `hash`). */
export function loadMerkleResult(path: string): MerkleResult {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<MerkleResult>;

  if (
    typeof raw.merkleRoot !== "string" ||
    typeof raw.chunkSize !== "number" ||
    typeof raw.chunkCount !== "number" ||
    !Array.isArray(raw.chunkHashes)
  ) {
    throw new Error(`Invalid expected Merkle JSON: ${path}`);
  }

  return {
    chunkSize: raw.chunkSize,
    chunkCount: raw.chunkCount,
    chunkHashes: raw.chunkHashes,
    merkleRoot: raw.merkleRoot,
  };
}

/**
 * Compare a freshly computed Merkle result against a stored expectation.
 * Reports which chunk (leaf) indices differ so a caller can see exactly where
 * the bytes changed, not just that the roots disagree.
 */
export function verifyAgainstExpected(
  actual: MerkleResult,
  expected: MerkleResult,
): VerificationResult {
  const chunkSizeMatched = actual.chunkSize === expected.chunkSize;
  const chunkCountMatched = actual.chunkCount === expected.chunkCount;

  const changedChunkIndices: number[] = [];
  const unchangedChunkIndices: number[] = [];
  const maxChunks = Math.max(
    actual.chunkHashes.length,
    expected.chunkHashes.length,
  );

  for (let i = 0; i < maxChunks; i += 1) {
    if (actual.chunkHashes[i] === expected.chunkHashes[i]) {
      unchangedChunkIndices.push(i);
    } else {
      changedChunkIndices.push(i);
    }
  }

  return {
    matched: chunkSizeMatched && actual.merkleRoot === expected.merkleRoot,
    expectedMerkleRoot: expected.merkleRoot,
    actualMerkleRoot: actual.merkleRoot,
    chunkSizeMatched,
    chunkCountMatched,
    changedChunkIndices,
    unchangedChunkIndices,
  };
}
