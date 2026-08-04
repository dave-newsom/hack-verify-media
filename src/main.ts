import { writeFile } from "node:fs/promises";

import { DEFAULT_CHUNK_SIZE } from "./chunks";
import { calculateFileMerkleRoot } from "./fileMerkle";
import { sidecarBase, verifyFile } from "./verify";

function printUsage(): void {
  console.error(`Usage:
  npm run hash -- <path-to-file> [chunk-size-bytes]
  npm run verify -- <path-to-file>

Default chunk size: ${DEFAULT_CHUNK_SIZE} bytes (256 KiB).
hash writes <path>-hash.md; verify reads it and writes <path>-verified.md.`);
}

function parseChunkSize(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid chunk size "${raw}". Expected a positive integer (bytes).`,
    );
  }
  return parsed;
}

/** `hash <file> [chunkSize]` | `verify <file>` */
function parseArgs(args: string[]): {
  command: string | undefined;
  filePath: string | undefined;
  chunkSize: number;
} {
  const command = args[0];
  let chunkSize = DEFAULT_CHUNK_SIZE;
  const filePath = args[1];

  if (args.length >= 3 && /^\d+$/.test(args[args.length - 1])) {
    chunkSize = parseChunkSize(args[args.length - 1]);
  }

  return { command, filePath, chunkSize };
}

async function runHash(
  filePath: string | undefined,
  chunkSize: number,
): Promise<void> {
  if (!filePath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await calculateFileMerkleRoot(filePath, chunkSize);
  const json = JSON.stringify(result);
  console.log(json);
  await writeFile(`${sidecarBase(filePath)}-hash.md`, json);
}

async function runVerify(filePath: string | undefined): Promise<void> {
  if (!filePath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const verified = await verifyFile(filePath);
  if (!verified) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const { command, filePath, chunkSize } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "hash":
      await runHash(filePath, chunkSize);
      return;
    case "verify":
      await runVerify(filePath);
      return;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred.";

  console.error(`Failed: ${message}`);
  process.exitCode = 1;
});
