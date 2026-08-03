import { readFileSync } from "node:fs";
import type { MerkleResult } from "./fileMerkle";

export type VerifyResult = {
  matched: boolean;
  chunkSize: number;
  chunkCount: number;
  changedChunkIndices: number[];
  unchangedChunkIndices: number[];
  expectedMerkleRoot: string;
  actualMerkleRoot: string;
};

export function loadMerkleResult(path: string): MerkleResult {
  const raw = JSON.parse(readFileSync(path, "utf8")) as MerkleResult;
  if (
    !Array.isArray(raw.chunkHashes) ||
    typeof raw.merkleRoot !== "string" ||
    typeof raw.chunkCount !== "number"
  ) {
    throw new Error(`Invalid Merkle JSON: ${path}`);
  }
  return raw;
}

export function verifyAgainstExpected(
  actual: MerkleResult,
  expected: MerkleResult,
): VerifyResult {
  if (actual.chunkSize !== expected.chunkSize) {
    throw new Error(
      `chunkSize mismatch: actual ${actual.chunkSize} vs expected ${expected.chunkSize}`,
    );
  }

  if (actual.chunkCount !== expected.chunkCount) {
    throw new Error(
      `chunkCount mismatch: actual ${actual.chunkCount} vs expected ${expected.chunkCount}`,
    );
  }

  const changedChunkIndices: number[] = [];
  const unchangedChunkIndices: number[] = [];

  for (let i = 0; i < expected.chunkHashes.length; i += 1) {
    if (actual.chunkHashes[i] === expected.chunkHashes[i]) {
      unchangedChunkIndices.push(i);
    } else {
      changedChunkIndices.push(i);
    }
  }

  const merkleRootMatched = actual.merkleRoot === expected.merkleRoot;

  return {
    matched: changedChunkIndices.length === 0 && merkleRootMatched,
    chunkSize: actual.chunkSize,
    chunkCount: actual.chunkCount,
    changedChunkIndices,
    unchangedChunkIndices,
    expectedMerkleRoot: expected.merkleRoot,
    actualMerkleRoot: actual.merkleRoot,
  };
}
