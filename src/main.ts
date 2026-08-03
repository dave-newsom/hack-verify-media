import { DEFAULT_CHUNK_SIZE } from "./chunks";
import { calculateFileMerkleRoot } from "./fileMerkle";
import { loadMerkleResult, verifyAgainstExpected } from "./verify";

function printUsage(): void {
  console.error(`Usage:
  npm run hash -- <path-to-file> [chunk-size-bytes]
  npm run verify -- <path-to-file> <expected-merkle.json>

Default chunk size: ${DEFAULT_CHUNK_SIZE} bytes (256 KiB).
verify uses the chunkSize stored in the expected Merkle JSON.`);
}

type ParsedArgs = {
  chunkSize: number;
  positional: string[];
};

function parseArgs(args: string[]): ParsedArgs {
  let chunkSize = DEFAULT_CHUNK_SIZE;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--chunk-size" || arg.startsWith("--chunk-size=")) {
      const raw = arg.includes("=") ? arg.split("=", 2)[1] : args[i + 1];
      if (!arg.includes("=")) {
        i += 1;
      }
      if (!raw) {
        throw new Error("Missing value for --chunk-size.");
      }

      chunkSize = parseChunkSize(raw);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  // npm on Windows often strips flags like --chunk-size; allow
  // `hash <file> <chunk-size-bytes>` as a portable alternative.
  if (positional.length >= 2 && /^\d+$/.test(positional[positional.length - 1])) {
    chunkSize = parseChunkSize(positional.pop() as string);
  }

  return { chunkSize, positional };
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
  console.log(JSON.stringify(result, null, 2));
}

async function runVerify(
  filePath: string | undefined,
  expectedPath: string | undefined,
): Promise<void> {
  if (!filePath || !expectedPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const expected = loadMerkleResult(expectedPath);
  const actual = await calculateFileMerkleRoot(filePath, expected.chunkSize);
  const result = verifyAgainstExpected(actual, expected);

  console.log(JSON.stringify(result, null, 2));

  if (!result.matched) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const { chunkSize, positional } = parseArgs(args);

  switch (command) {
    case "hash":
      await runHash(positional[0], chunkSize);
      return;
    case "verify":
      await runVerify(positional[0], positional[1]);
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
