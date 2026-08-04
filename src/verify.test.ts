import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { verifyFile } from "./verify";
import type { MerkleResult } from "./fileMerkle";

function sampleResult(overrides: Partial<MerkleResult> = {}): MerkleResult {
  return {
    chunkSize: 262144,
    chunkCount: 3,
    merkleRoot: "root",
    ...overrides,
  };
}

test("loadMerkleResult parses a valid expected JSON file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-test-"));
  const path = join(dir, "expected.json");
  await writeFile(path, JSON.stringify(sampleResult()));

  const loaded = await verifyFile(path);
  assert.equal(loaded.merkleRoot, "root");
  assert.equal(loaded.chunkCount, 3);
});

test("loadMerkleResult throws on a malformed expected JSON file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-test-"));
  const path = join(dir, "bad.json");
  await writeFile(path, JSON.stringify({ merkleRoot: "x" })); // missing required fields

  assert.throws(() => verifyFile(path), /Invalid expected Merkle JSON/);
});
