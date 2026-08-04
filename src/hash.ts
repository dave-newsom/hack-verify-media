import { createHash } from "node:crypto";

/** Precomputed SHA-256 of empty input (avoids alloc on empty files). */
export const SHA256_EMPTY = Buffer.from(
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "hex",
);

export function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

/** Parent hash without allocating a concatenated buffer. */
export function sha256Pair(left: Buffer, right: Buffer): Buffer {
  return createHash("sha256").update(left).update(right).digest();
}
