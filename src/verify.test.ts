import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadMerkleResult, verifyAgainstExpected } from "./verify";
import type { MerkleResult } from "./fileMerkle";

function sampleResult(overrides: Partial<MerkleResult> = {}): MerkleResult {
  return {
    chunkSize: 262144,
    chunkCount: 3,
    chunkHashes: ["h0", "h1", "h2"],
    merkleRoot: "root",
    ...overrides,
  };
}

test("verifyAgainstExpected matches identical results", () => {
  const r = verifyAgainstExpected(sampleResult(), sampleResult());

  assert.equal(r.matched, true);
  assert.deepEqual(r.changedChunkIndices, []);
  assert.deepEqual(r.unchangedChunkIndices, [0, 1, 2]);
  assert.equal(r.chunkSizeMatched, true);
  assert.equal(r.chunkCountMatched, true);
});

test("verifyAgainstExpected reports the single changed chunk index", () => {
  const actual = sampleResult({ chunkHashes: ["h0", "XX", "h2"], merkleRoot: "root2" });
  const r = verifyAgainstExpected(actual, sampleResult());

  assert.equal(r.matched, false);
  assert.deepEqual(r.changedChunkIndices, [1]);
  assert.deepEqual(r.unchangedChunkIndices, [0, 2]);
});

test("verifyAgainstExpected flags extra chunks when counts differ", () => {
  const actual = sampleResult({
    chunkCount: 4,
    chunkHashes: ["h0", "h1", "h2", "h3"],
    merkleRoot: "root2",
  });
  const r = verifyAgainstExpected(actual, sampleResult());

  assert.equal(r.chunkCountMatched, false);
  assert.deepEqual(r.changedChunkIndices, [3]);
});

test("verifyAgainstExpected fails when chunkSize differs even if roots match", () => {
  const r = verifyAgainstExpected(sampleResult({ chunkSize: 1048576 }), sampleResult());

  assert.equal(r.chunkSizeMatched, false);
  assert.equal(r.matched, false);
});

test("loadMerkleResult parses a valid expected JSON file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-test-"));
  const path = join(dir, "expected.json");
  await writeFile(path, JSON.stringify(sampleResult()));

  const loaded = loadMerkleResult(path);
  assert.equal(loaded.merkleRoot, "root");
  assert.equal(loaded.chunkCount, 3);
  assert.deepEqual(loaded.chunkHashes, ["h0", "h1", "h2"]);
});

test("loadMerkleResult throws on a malformed expected JSON file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-test-"));
  const path = join(dir, "bad.json");
  await writeFile(path, JSON.stringify({ merkleRoot: "x" })); // missing required fields

  assert.throws(() => loadMerkleResult(path), /Invalid expected Merkle JSON/);
});
