/**
 * Timing / resource report for edge-oriented hash + verify.
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
import { sidecarBase, verifyFile } from "../src/verify";

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
  matched: boolean | null;
  wallMs: number;
  userMs: number;
  systemMs: number;
  heapDeltaMb: number;
  rssMb: number;
  throughputMBps: number;
};

async function writeSidecar(
  sample: Sample,
  merkleRoot: string,
): Promise<number> {
  const result = await calculateFileMerkleRoot(sample.path, sample.chunkSize);
  await writeFile(
    `${sidecarBase(sample.path)}-hash.md`,
    JSON.stringify({
      chunkSize: result.chunkSize,
      chunkCount: result.chunkCount,
      merkleRoot,
    }),
  );
  return result.chunkCount;
}

async function measureHash(sample: Sample): Promise<Measurement> {
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
    matched: null,
    wallMs,
    userMs: cpu.user / 1000,
    systemMs: cpu.system / 1000,
    heapDeltaMb: (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024),
    rssMb: memAfter.rss / (1024 * 1024),
    throughputMBps: sample.bytes / (1024 * 1024) / (wallMs / 1000),
  };
}

async function measureVerify(
  sample: Sample,
  labelSuffix: "pass" | "fail",
  chunkCount: number,
  expectMatch: boolean,
): Promise<Measurement> {
  // Warm path with the same sidecar outcome we're about to measure.
  const warmed = await verifyFile(sample.path);
  if (warmed.verified !== expectMatch) {
    throw new Error(
      `verify warmup mismatch for ${sample.label} (${labelSuffix}): got ${warmed}`,
    );
  }

  if (typeof global.gc === "function") {
    global.gc();
  }

  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const t0 = performance.now();

  const matched = await verifyFile(sample.path);

  const wallMs = performance.now() - t0;
  const cpu = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage();

  if (matched.verified !== expectMatch) {
    throw new Error(
      `verify result mismatch for ${sample.label} (${labelSuffix}): got ${matched}`,
    );
  }

  return {
    label: `${sample.label}:${labelSuffix}`,
    bytes: sample.bytes,
    chunkSize: sample.chunkSize,
    chunkCount,
    matched: matched.verified,
    wallMs,
    userMs: cpu.user / 1000,
    systemMs: cpu.system / 1000,
    heapDeltaMb: (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024),
    rssMb: memAfter.rss / (1024 * 1024),
    throughputMBps: sample.bytes / (1024 * 1024) / (wallMs / 1000),
  };
}

function printTable(title: string, rows: Measurement[], includeMatch: boolean): void {
  console.log(title);
  const header = [
    "label".padEnd(28),
    "bytes".padStart(10),
    "chunks".padStart(7),
    ...(includeMatch ? ["match".padStart(6)] : []),
    "elapsed_ms".padStart(11),
    "cpu_user_ms".padStart(12),
    "cpu_kern_ms".padStart(12),
    "heap_delta_MB".padStart(14),
    "rss_MB".padStart(8),
    "MB/s".padStart(8),
  ].join("  ");

  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        row.label.padEnd(28),
        String(row.bytes).padStart(10),
        String(row.chunkCount).padStart(7),
        ...(includeMatch
          ? [
              (row.matched === null ? "-" : row.matched ? "yes" : "no").padStart(
                6,
              ),
            ]
          : []),
        row.wallMs.toFixed(2).padStart(11),
        row.userMs.toFixed(2).padStart(12),
        row.systemMs.toFixed(2).padStart(12),
        row.heapDeltaMb.toFixed(2).padStart(14),
        row.rssMb.toFixed(1).padStart(8),
        row.throughputMBps.toFixed(1).padStart(8),
      ].join("  "),
    );
  }
  console.log("");
}

async function main(): Promise<void> {
  const cliPath = process.argv[2];
  const cliChunk = process.argv[3] ? Number(process.argv[3]) : DEFAULT_CHUNK_SIZE;
  const dir = await mkdtemp(join(tmpdir(), "hvm-bench-"));
  const hashRows: Measurement[] = [];
  const verifyRows: Measurement[] = [];

  try {
    const samples: Sample[] = [];

    const synthetic: Array<{ label: string; bytes: number }> = [
      { label: "empty", bytes: 0 },
      { label: "256KiB-1chunk", bytes: DEFAULT_CHUNK_SIZE },
      { label: "1MiB-4chunks", bytes: DEFAULT_CHUNK_SIZE * 4 },
      { label: "5MiB-20chunks", bytes: DEFAULT_CHUNK_SIZE * 20 },
    ];

    for (const item of synthetic) {
      const path = join(dir, `${item.label}.bin`);
      await writeFile(path, Buffer.alloc(item.bytes, 0x5a));
      samples.push({
        label: item.label,
        path,
        bytes: item.bytes,
        chunkSize: DEFAULT_CHUNK_SIZE,
      });
    }

    const chaplin = join(
      __dirname,
      "..",
      "..",
      "fixtures",
      "media",
      "chaplin_laughing_gas.mp4",
    );
    try {
      const info = await stat(chaplin);
      samples.push({
        label: "chaplin-fixture",
        path: chaplin,
        bytes: info.size,
        chunkSize: DEFAULT_CHUNK_SIZE,
      });
    } catch {
      console.error("(skip chaplin-fixture: media not present)");
    }

    if (cliPath) {
      const info = await stat(cliPath);
      samples.push({
        label: "cli-input",
        path: cliPath,
        bytes: info.size,
        chunkSize: cliChunk,
      });
    }

    for (const sample of samples) {
      hashRows.push(await measureHash(sample));

      const good = await calculateFileMerkleRoot(sample.path, sample.chunkSize);
      const chunkCount = await writeSidecar(sample, good.merkleRoot);
      verifyRows.push(await measureVerify(sample, "pass", chunkCount, true));

      // Negative case: same file, wrong expected root in the sidecar.
      await writeSidecar(sample, "0".repeat(64));
      verifyRows.push(await measureVerify(sample, "fail", chunkCount, false));
    }

    console.log(
      `chunkSize=${DEFAULT_CHUNK_SIZE} bytes (override via: npm run bench -- <file> <chunk-size>)`,
    );
    console.log(`Columns:
  elapsed_ms    real stopwatch time until the call returns (best “how long did it take?”)
  cpu_user_ms   CPU time in this process (JS / crypto); coarse on Windows for short runs
  cpu_kern_ms   CPU time in the kernel (e.g. file I/O); also coarse for short runs
  heap_delta_MB change in JS heap during the call
  rss_MB        process resident memory after the call
  MB/s          bytes processed / elapsed_ms
`);
    console.log(
      "Tip: node --expose-gc node_modules/ts-node/dist/bin.js test/bench.ts for clearer heap deltas.\n",
    );
    printTable("HASH (calculateFileMerkleRoot)", hashRows, false);
    printTable(
      "VERIFY (pass = matching -hash.md, fail = mismatched -hash.md)",
      verifyRows,
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Bench failed: ${message}`);
  process.exitCode = 1;
});
