import { open } from "node:fs/promises";
import { SHA256_EMPTY, sha256 } from "./hash";

export const DEFAULT_CHUNK_SIZE = 256 * 1024; // 256 KiB

/**
 * Hash each exact chunk of a file.
 * One reused read buffer; never loads the whole file into memory.
 */
export async function hashExactFileChunks(
  filePath: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<Buffer[]> {
  const file = await open(filePath, "r");

  try {
    const { size } = await file.stat();

    if (size === 0) {
      return [SHA256_EMPTY];
    }

    const chunkCount = Math.ceil(size / chunkSize);
    const hashes: Buffer[] = new Array(chunkCount);
    const buffer = Buffer.allocUnsafe(chunkSize);
    let position = 0;

    for (let i = 0; i < chunkCount; i += 1) {
      const bytesToRead = Math.min(chunkSize, size - position);
      const { bytesRead } = await file.read(buffer, 0, bytesToRead, position);

      if (bytesRead !== bytesToRead) {
        throw new Error(
          `Unexpected end of file at byte position ${position}.`,
        );
      }

      hashes[i] = sha256(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }

    return hashes;
  } finally {
    await file.close();
  }
}
