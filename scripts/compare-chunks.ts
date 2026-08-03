#!/usr/bin/env ts-node
/**
 * Compare two Merkle CLI JSON outputs and report which chunk indices differ.
 *
 * Usage:
 *   npm run -s merkle -- fixtures/media/chaplin_laughing_gas.mp4 > /tmp/orig.json
 *   npm run -s merkle -- fixtures/media/chaplin_laughing_gas_edit_chunk2.mp4 > /tmp/edit.json
 *   npm run -s compare-chunks -- /tmp/orig.json /tmp/edit.json
 */

import { readFileSync } from "node:fs";

type MerkleResult = {
  chunkSize: number;
  chunkCount: number;
  chunkHashes: string[];
  merkleRoot: string;
};

function loadResult(path: string): MerkleResult {
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

function main(): void {
  const leftPath = process.argv[2];
  const rightPath = process.argv[3];

  if (!leftPath || !rightPath) {
    console.error(
      "Usage: npm run compare-chunks -- <original.json> <edited.json>",
    );
    process.exitCode = 1;
    return;
  }

  const left = loadResult(leftPath);
  const right = loadResult(rightPath);

  if (left.chunkSize !== right.chunkSize) {
    console.error(
      `chunkSize mismatch: ${left.chunkSize} vs ${right.chunkSize}`,
    );
    process.exitCode = 1;
    return;
  }

  if (left.chunkCount !== right.chunkCount) {
    console.error(
      `chunkCount mismatch: ${left.chunkCount} vs ${right.chunkCount}`,
    );
    process.exitCode = 1;
    return;
  }

  const changed: number[] = [];
  const unchanged: number[] = [];

  for (let i = 0; i < left.chunkHashes.length; i += 1) {
    if (left.chunkHashes[i] === right.chunkHashes[i]) {
      unchanged.push(i);
    } else {
      changed.push(i);
    }
  }

  const rootChanged = left.merkleRoot !== right.merkleRoot;

  console.log(
    JSON.stringify(
      {
        chunkSize: left.chunkSize,
        chunkCount: left.chunkCount,
        changedChunkIndices: changed,
        unchangedChunkIndices: unchanged,
        merkleRootChanged: rootChanged,
        originalMerkleRoot: left.merkleRoot,
        editedMerkleRoot: right.merkleRoot,
      },
      null,
      2,
    ),
  );

  if (changed.length === 0 && !rootChanged) {
    console.error("No differences found.");
    process.exitCode = 2;
  }
}

main();
