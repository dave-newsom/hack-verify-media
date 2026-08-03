import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MiB

function combineHashes(left: Buffer, right: Buffer): Buffer {
  return sha256(Buffer.concat([left, right]));
}

export function buildMerkleRoot(leafHashes: Buffer[]): Buffer {
  if (leafHashes.length === 0) {
    throw new Error("Cannot build a Merkle root with no leaves.");
  }

  let currentLevel = leafHashes.map((hash) => Buffer.from(hash));

  while (currentLevel.length > 1) {
    const nextLevel: Buffer[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right =
        i + 1 < currentLevel.length
          ? currentLevel[i + 1]
          : left; // duplicate the final node if the count is odd

      nextLevel.push(combineHashes(left, right));
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

export async function hashExactFileChunks(
  filePath: string,
  chunkSize = 1024 * 1024,
): Promise<Buffer[]> {
  const file = await open(filePath, "r");

  try {
    const { size } = await file.stat();
    const hashes: Buffer[] = [];

    if (size === 0) {
      return [sha256(Buffer.alloc(0))];
    }

    let position = 0;

    while (position < size) {
      const bytesToRead = Math.min(chunkSize, size - position);
      const buffer = Buffer.allocUnsafe(bytesToRead);

      const { bytesRead } = await file.read(
        buffer,
        0,
        bytesToRead,
        position,
      );

      if (bytesRead === 0) {
        throw new Error(
          `Unexpected end of file at byte position ${position}.`,
        );
      }

      const chunk = buffer.subarray(0, bytesRead);
      hashes.push(sha256(chunk));
      position += bytesRead;
    }

    return hashes;
  } finally {
    await file.close();
  }
}

export async function calculateFileMerkleRoot(
  filePath: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<{
  chunkSize: number;
  chunkCount: number;
  chunkHashes: string[];
  merkleRoot: string;
}> {
  const chunkHashes = await hashExactFileChunks(filePath, chunkSize);
  const merkleRoot = buildMerkleRoot(chunkHashes);

  return {
    chunkSize,
    chunkCount: chunkHashes.length,
    chunkHashes: chunkHashes.map((hash) => hash.toString("hex")),
    merkleRoot: merkleRoot.toString("hex"),
  };
}

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: npm run merkle -- <path-to-file>");
    process.exitCode = 1;
    return;
  }

  const result = await calculateFileMerkleRoot(filePath);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred.";

  console.error(`Failed to calculate Merkle root: ${message}`);
  process.exitCode = 1;
});
