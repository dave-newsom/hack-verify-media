import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { after, before, describe, it } from "node:test";
import { DEFAULT_CHUNK_SIZE } from "../src/chunks";
import { calculateFileMerkleRoot } from "../src/fileMerkle";
import { sidecarBase, verifyFile } from "../src/verify";

/**
 * Lightweight timing assertions so CI fails if hashing/verify becomes pathologically slow.
 * Absolute numbers vary by machine; bounds are intentionally loose.
 */
describe("hashing resource profile", () => {
  let dir = "";
  let path1MiB = "";

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "hvm-timing-"));
    path1MiB = join(dir, "1mibin");
    await writeFile(path1MiB, Buffer.alloc(DEFAULT_CHUNK_SIZE * 4, 0x11));
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("hashes 1 MiB within a loose wall-clock budget", async () => {
    await calculateFileMerkleRoot(path1MiB, DEFAULT_CHUNK_SIZE);

    const cpuBefore = process.cpuUsage();
    const t0 = performance.now();
    const result = await calculateFileMerkleRoot(path1MiB, DEFAULT_CHUNK_SIZE);
    const wallMs = performance.now() - t0;
    const cpu = process.cpuUsage(cpuBefore);

    assert.equal(result.chunkCount, 4);
    assert.ok(wallMs < 5_000, `wall clock too high: ${wallMs.toFixed(1)}ms`);
    assert.ok(
      cpu.user + cpu.system < 5_000_000,
      `cpu time too high: ${((cpu.user + cpu.system) / 1000).toFixed(1)}ms`,
    );

    console.log(
      JSON.stringify({
        benchmark: "1MiB-hash",
        bytes: DEFAULT_CHUNK_SIZE * 4,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkCount: result.chunkCount,
        wallMs: Number(wallMs.toFixed(2)),
        userMs: Number((cpu.user / 1000).toFixed(2)),
        systemMs: Number((cpu.system / 1000).toFixed(2)),
        rssMb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1)),
      }),
    );
  });

  it("verifies 1 MiB pass and fail within a loose wall-clock budget", async () => {
    const hashed = await calculateFileMerkleRoot(path1MiB, DEFAULT_CHUNK_SIZE);
    const hashPath = `${sidecarBase(path1MiB)}-hash.md`;

    await writeFile(hashPath, JSON.stringify(hashed));
    await verifyFile(path1MiB);
    {
      const cpuBefore = process.cpuUsage();
      const t0 = performance.now();
      const ok = await verifyFile(path1MiB);
      const wallMs = performance.now() - t0;
      const cpu = process.cpuUsage(cpuBefore);

      assert.equal(ok, true);
      assert.ok(wallMs < 5_000, `verify-pass wall too high: ${wallMs.toFixed(1)}ms`);

      console.log(
        JSON.stringify({
          benchmark: "1MiB-verify-pass",
          matched: true,
          bytes: DEFAULT_CHUNK_SIZE * 4,
          chunkSize: DEFAULT_CHUNK_SIZE,
          chunkCount: hashed.chunkCount,
          wallMs: Number(wallMs.toFixed(2)),
          userMs: Number((cpu.user / 1000).toFixed(2)),
          systemMs: Number((cpu.system / 1000).toFixed(2)),
          rssMb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1)),
        }),
      );
    }

    await writeFile(
      hashPath,
      JSON.stringify({ ...hashed, merkleRoot: "0".repeat(64) }),
    );
    await verifyFile(path1MiB);
    {
      const cpuBefore = process.cpuUsage();
      const t0 = performance.now();
      const ok = await verifyFile(path1MiB);
      const wallMs = performance.now() - t0;
      const cpu = process.cpuUsage(cpuBefore);

      assert.equal(ok, false);
      assert.ok(wallMs < 5_000, `verify-fail wall too high: ${wallMs.toFixed(1)}ms`);

      console.log(
        JSON.stringify({
          benchmark: "1MiB-verify-fail",
          matched: false,
          bytes: DEFAULT_CHUNK_SIZE * 4,
          chunkSize: DEFAULT_CHUNK_SIZE,
          chunkCount: hashed.chunkCount,
          wallMs: Number(wallMs.toFixed(2)),
          userMs: Number((cpu.user / 1000).toFixed(2)),
          systemMs: Number((cpu.system / 1000).toFixed(2)),
          rssMb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1)),
        }),
      );
    }
  });

  it("reports chaplin fixture hash + verify timing when present", async (t) => {
    const chaplin = join(
      __dirname,
      "..",
      "..",
      "fixtures",
      "media",
      "chaplin_laughing_gas.mp4",
    );

    let bytes = 0;
    try {
      bytes = (await stat(chaplin)).size;
    } catch {
      t.skip("chaplin fixture missing");
      return;
    }

    await calculateFileMerkleRoot(chaplin, DEFAULT_CHUNK_SIZE);
    const result = await calculateFileMerkleRoot(chaplin, DEFAULT_CHUNK_SIZE);
    {
      const cpuBefore = process.cpuUsage();
      const t0 = performance.now();
      await calculateFileMerkleRoot(chaplin, DEFAULT_CHUNK_SIZE);
      const wallMs = performance.now() - t0;
      const cpu = process.cpuUsage(cpuBefore);

      assert.ok(
        wallMs < 30_000,
        `chaplin hash wall clock too high: ${wallMs.toFixed(1)}ms`,
      );

      console.log(
        JSON.stringify({
          benchmark: "chaplin-hash",
          bytes,
          chunkSize: DEFAULT_CHUNK_SIZE,
          chunkCount: result.chunkCount,
          wallMs: Number(wallMs.toFixed(2)),
          userMs: Number((cpu.user / 1000).toFixed(2)),
          systemMs: Number((cpu.system / 1000).toFixed(2)),
          rssMb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1)),
          throughputMBps: Number(
            (bytes / (1024 * 1024) / (wallMs / 1000)).toFixed(2),
          ),
        }),
      );
    }

    const hashPath = `${sidecarBase(chaplin)}-hash.md`;
    await writeFile(hashPath, JSON.stringify(result));
    await verifyFile(chaplin);
    {
      const cpuBefore = process.cpuUsage();
      const t0 = performance.now();
      const ok = await verifyFile(chaplin);
      const wallMs = performance.now() - t0;
      const cpu = process.cpuUsage(cpuBefore);

      assert.equal(ok, true);
      assert.ok(
        wallMs < 30_000,
        `chaplin verify-pass wall too high: ${wallMs.toFixed(1)}ms`,
      );

      console.log(
        JSON.stringify({
          benchmark: "chaplin-verify-pass",
          matched: true,
          bytes,
          chunkSize: DEFAULT_CHUNK_SIZE,
          wallMs: Number(wallMs.toFixed(2)),
          userMs: Number((cpu.user / 1000).toFixed(2)),
          systemMs: Number((cpu.system / 1000).toFixed(2)),
          rssMb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1)),
          throughputMBps: Number(
            (bytes / (1024 * 1024) / (wallMs / 1000)).toFixed(2),
          ),
        }),
      );
    }

    await writeFile(
      hashPath,
      JSON.stringify({ ...result, merkleRoot: "0".repeat(64) }),
    );
    await verifyFile(chaplin);
    {
      const cpuBefore = process.cpuUsage();
      const t0 = performance.now();
      const ok = await verifyFile(chaplin);
      const wallMs = performance.now() - t0;
      const cpu = process.cpuUsage(cpuBefore);

      assert.equal(ok, false);
      assert.ok(
        wallMs < 30_000,
        `chaplin verify-fail wall too high: ${wallMs.toFixed(1)}ms`,
      );

      console.log(
        JSON.stringify({
          benchmark: "chaplin-verify-fail",
          matched: false,
          bytes,
          chunkSize: DEFAULT_CHUNK_SIZE,
          wallMs: Number(wallMs.toFixed(2)),
          userMs: Number((cpu.user / 1000).toFixed(2)),
          systemMs: Number((cpu.system / 1000).toFixed(2)),
          rssMb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1)),
          throughputMBps: Number(
            (bytes / (1024 * 1024) / (wallMs / 1000)).toFixed(2),
          ),
        }),
      );
    }
  });
});
