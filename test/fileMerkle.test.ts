import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { calculateFileMerkleRoot } from "../src/fileMerkle";
import { verifyFile } from "../src/verify";

const repoRoot = join(__dirname, "..", "..");
const fixturesDir = join(repoRoot, "fixtures");
const mediaDir = join(fixturesDir, "media");
const expectedRootsPath = join(fixturesDir, "expected-roots.json");

async function mediaExists(name: string): Promise<boolean> {
  try {
    await access(join(mediaDir, name));
    return true;
  } catch {
    return false;
  }
}

describe("calculateFileMerkleRoot", () => {
  it("matches golden roots for committed fixtures", async (t) => {
    let expected: Record<
      string,
      { chunkSize: number; chunkCount: number; merkleRoot: string }
    >;
    try {
      expected = JSON.parse(readFileSync(expectedRootsPath, "utf8")) as Record<
        string,
        { chunkSize: number; chunkCount: number; merkleRoot: string }
      >;
    } catch {
      t.skip("missing fixtures/expected-roots.json");
      return;
    }

    let sawAny = false;
    for (const [name, golden] of Object.entries(expected)) {
      if (!(await mediaExists(name))) {
        continue;
      }
      sawAny = true;

      const result = await calculateFileMerkleRoot(
        join(mediaDir, name),
        golden.chunkSize,
      );
      assert.equal(result.chunkCount, golden.chunkCount, name);
      assert.equal(result.merkleRoot, golden.merkleRoot, name);
    }

    if (!sawAny) {
      t.skip("no media fixtures present under fixtures/media");
    }
  });
});

describe("verifyFile", () => {
  let dir = "";

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "hvm-verify-"));
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes VERIFIED when the sidecar hash matches", async () => {
    const filePath = join(dir, "clip.bin");
    await writeFile(filePath, Buffer.from("ok"));
    const hashed = await calculateFileMerkleRoot(filePath);
    await writeFile(
      join(dir, "clip-hash.md"),
      JSON.stringify({ merkleRoot: hashed.merkleRoot, chunkSize: hashed.chunkSize }),
    );

    const verified = await verifyFile(filePath);
    assert.equal(verified, true);
    assert.equal(await readFile(join(dir, "clip-verified.md"), "utf8"), "VERIFIED");
  });

  it("writes VERIFY FAILED when the sidecar hash differs", async () => {
    const filePath = join(dir, "bad.bin");
    await writeFile(filePath, Buffer.from("ok"));
    await writeFile(
      join(dir, "bad-hash.md"),
      JSON.stringify({ merkleRoot: "0".repeat(64) }),
    );

    const verified = await verifyFile(filePath);
    assert.equal(verified, false);
    assert.equal(
      await readFile(join(dir, "bad-verified.md"), "utf8"),
      "VERIFY FAILED",
    );
  });
});
