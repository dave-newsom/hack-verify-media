/**
 * Timing / resource report for edge-oriented hashing.
 *
 * Usage: npm run bench
 * Optional: npm run bench -- [path-to-file] [chunk-size-bytes]
 */
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DEFAULT_CHUNK_SIZE } from "../src/chunks";
import { calculateFileMerkleRoot } from "../src/fileMerkle";

type Sample = {
  label: string;
  path: string;
  bytes: number;
  chunkSize: number;
};

type Measurement = {
  label: string;
  bytes: number;
  chunkSize: number;
  chunkCount: number;
  wallMs: number;
  userMs: number;
  systemMs: number;
  heapDeltaMb: number;
  rssMb: number;
  throughputMBps: number;
};

async function measure(sample: Sample): Promise<Measurement> {
  // Warm one call so first-import / JIT noise is outside the sample when possible.
  await calculateFileMerkleRoot(sample.path, sample.chunkSize);

  if (typeof global.gc === "function") {
    global.gc();
  }

  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const t0 = performance.now();

  const result = await calculateFileMerkleRoot(sample.path, sample.chunkSize);

  const wallMs = performance.now() - t0;
  const cpu = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage();

  return {
    label: sample.label,
    bytes: sample.bytes,
    chunkSize: sample.chunkSize,
    chunkCount: result.chunkCount,
    wallMs,
    userMs: cpu.user / 1000,
    systemMs: cpu.system / 1000,
    heapDeltaMb: (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024),
    rssMb: memAfter.rss / (1024 * 1024),
    throughputMBps: sample.bytes / (1024 * 1024) / (wallMs / 1000),
  };
}

function printTable(rows: Measurement[]): void {
  const header = [
    "label".padEnd(22),
    "size".padStart(10),
    "chunks".padStart(7),
    "wall_ms".padStart(10),
    "user_ms".padStart(10),
    "sys_ms".padStart(9),
    "heap_ΔMB".padStart(10),
    "rss_MB".padStart(9),
    "MB/s".padStart(8),
  ].join("  ");

  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        row.label.padEnd(22),
        String(row.bytes).padStart(10),
        String(row.chunkCount).padStart(7),
        row.wallMs.toFixed(2).padStart(10),
        row.userMs.toFixed(2).padStart(10),
        row.systemMs.toFixed(2).padStart(9),
        row.heapDeltaMb.toFixed(2).padStart(10),
        row.rssMb.toFixed(1).padStart(9),
        row.throughputMBps.toFixed(1).padStart(8),
      ].join("  "),
    );
  }
}

async function main(): Promise<void> {
  const cliPath = process.argv[2];
  const cliChunk = process.argv[3] ? Number(process.argv[3]) : DEFAULT_CHUNK_SIZE;
  const dir = await mkdtemp(join(tmpdir(), "hvm-bench-"));
  const rows: Measurement[] = [];

  try {
    const synthetic: Array<{ label: string; bytes: number }> = [
      { label: "empty", bytes: 0 },
      { label: "256KiB-1chunk", bytes: DEFAULT_CHUNK_SIZE },
      { label: "1MiB-4chunks", bytes: DEFAULT_CHUNK_SIZE * 4 },
      { label: "5MiB-20chunks", bytes: DEFAULT_CHUNK_SIZE * 20 },
    ];

    for (const item of synthetic) {
      const path = join(dir, `${item.label}.bin`);
      await writeFile(path, Buffer.alloc(item.bytes, 0x5a));
      rows.push(
        await measure({
          label: item.label,
          path,
          bytes: item.bytes,
          chunkSize: DEFAULT_CHUNK_SIZE,
        }),
      );
    }

    const chaplin = join(__dirname, "..", "..", "fixtures", "media", "chaplin_laughing_gas.mp4");
    try {
      const info = await stat(chaplin);
      rows.push(
        await measure({
          label: "chaplin-fixture",
          path: chaplin,
          bytes: info.size,
          chunkSize: DEFAULT_CHUNK_SIZE,
        }),
      );
    } catch {
      console.error("(skip chaplin-fixture: media not present)");
    }

    if (cliPath) {
      const info = await stat(cliPath);
      rows.push(
        await measure({
          label: "cli-input",
          path: cliPath,
          bytes: info.size,
          chunkSize: cliChunk,
        }),
      );
    }

    console.log(`chunkSize=${DEFAULT_CHUNK_SIZE} bytes (override via: npm run bench -- <file> <chunk-size>)`);
    console.log("Tip: node --expose-gc ./node_modules/ts-node/dist/bin.js test/bench.ts for clearer heap deltas.\n");
    printTable(rows);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Bench failed: ${message}`);
  process.exitCode = 1;
});
