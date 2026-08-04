import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendRoot,
  headHash,
  loadLedger,
  NoopAnchor,
  validateChain,
  type LedgerBlock,
} from "./ledger";

const GENESIS = "0".repeat(64);
const ROOT_A = "a".repeat(64);
const ROOT_B = "b".repeat(64);
const ROOT_C = "c".repeat(64);

async function tempLedgerPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ledger-test-"));
  return join(dir, "ledger.json");
}

test("appendRoot creates a genesis block with a zeroed prevHash", async () => {
  const path = await tempLedgerPath();
  const block = await appendRoot("clip-a.mp4", ROOT_A, path);

  assert.equal(block.index, 0);
  assert.equal(block.prevHash, GENESIS);
  assert.equal(block.mediaId, "clip-a.mp4");
  assert.equal(block.merkleRoot, ROOT_A);
  assert.match(block.blockHash, /^[0-9a-f]{64}$/);
});

test("appended blocks link prevHash to the previous blockHash", async () => {
  const path = await tempLedgerPath();
  const b0 = await appendRoot("a.mp4", ROOT_A, path);
  const b1 = await appendRoot("b.mp4", ROOT_B, path);
  const b2 = await appendRoot("c.mp4", ROOT_C, path);

  assert.equal(b1.index, 1);
  assert.equal(b2.index, 2);
  assert.equal(b1.prevHash, b0.blockHash);
  assert.equal(b2.prevHash, b1.blockHash);
});

test("appendRoot persists the chain to disk", async () => {
  const path = await tempLedgerPath();
  await appendRoot("a.mp4", ROOT_A, path);
  await appendRoot("b.mp4", ROOT_B, path);

  const onDisk = JSON.parse(await readFile(path, "utf8")) as LedgerBlock[];
  assert.equal(onDisk.length, 2);
  assert.equal(onDisk[1].mediaId, "b.mp4");
});

test("validateChain accepts a well-formed chain", async () => {
  const path = await tempLedgerPath();
  await appendRoot("a.mp4", ROOT_A, path);
  await appendRoot("b.mp4", ROOT_B, path);

  const result = validateChain(await loadLedger(path));
  assert.equal(result.valid, true);
  assert.equal(result.length, 2);
});

test("validateChain detects altered block contents", async () => {
  const path = await tempLedgerPath();
  await appendRoot("a.mp4", ROOT_A, path);
  await appendRoot("b.mp4", ROOT_B, path);
  const chain = await loadLedger(path);

  // Change a stored root but leave its (now-stale) blockHash in place.
  chain[1].merkleRoot = ROOT_C;

  const result = validateChain(chain);
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtIndex, 1);
  assert.match(result.reason ?? "", /blockHash mismatch/);
});

test("validateChain detects a broken prevHash link", async () => {
  const path = await tempLedgerPath();
  await appendRoot("a.mp4", ROOT_A, path);
  await appendRoot("b.mp4", ROOT_B, path);
  const chain = await loadLedger(path);

  chain[1].prevHash = "f".repeat(64);

  const result = validateChain(chain);
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtIndex, 1);
  assert.match(result.reason ?? "", /prevHash/);
});

test("headHash returns genesis when empty and the last blockHash otherwise", async () => {
  assert.equal(headHash([]), GENESIS);

  const path = await tempLedgerPath();
  const b0 = await appendRoot("a.mp4", ROOT_A, path);
  assert.equal(headHash(await loadLedger(path)), b0.blockHash);
});

test("loadLedger returns an empty array for a missing file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ledger-test-"));
  assert.deepEqual(await loadLedger(join(dir, "nope.json")), []);
});

test("NoopAnchor.commit reports local-only", async () => {
  assert.equal(await new NoopAnchor().commit("deadbeef"), "local-only");
});
