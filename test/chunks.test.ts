import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { hashExactFileChunks } from "../src/chunks";
import { sha256 } from "../src/hash";

describe("hashExactFileChunks", () => {
  let dir = "";

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "hvm-chunks-"));
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("hashes an empty file as a single empty digest", async () => {
    const path = join(dir, "empty.bin");
    await writeFile(path, Buffer.alloc(0));
    const hashes = await hashExactFileChunks(path, 64);
    assert.equal(hashes.length, 1);
    assert.equal(
      hashes[0].toString("hex"),
      sha256(Buffer.alloc(0)).toString("hex"),
    );
  });

  it("splits on an exact chunk boundary", async () => {
    const chunkSize = 32;
    const path = join(dir, "exact.bin");
    const data = Buffer.alloc(chunkSize * 2, 0xab);
    await writeFile(path, data);

    const hashes = await hashExactFileChunks(path, chunkSize);
    assert.equal(hashes.length, 2);
    assert.equal(
      hashes[0].toString("hex"),
      sha256(data.subarray(0, chunkSize)).toString("hex"),
    );
    assert.equal(
      hashes[1].toString("hex"),
      sha256(data.subarray(chunkSize)).toString("hex"),
    );
  });

  it("keeps a short final chunk", async () => {
    const chunkSize = 32;
    const path = join(dir, "short-tail.bin");
    const data = Buffer.alloc(chunkSize + 7, 0xcd);
    await writeFile(path, data);

    const hashes = await hashExactFileChunks(path, chunkSize);
    assert.equal(hashes.length, 2);
    assert.equal(
      hashes[1].toString("hex"),
      sha256(data.subarray(chunkSize)).toString("hex"),
    );
  });
});
