import { open } from "node:fs/promises";
import { sha256 } from "./hash";

export const DEFAULT_CHUNK_SIZE = 256 * 1024; // 256 KiB


export async function hashExactFileChunks(
  filePath: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
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
