import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

import { calculateFileMerkleRoot } from "./main";

async function verifyFile(filePath: string): Promise<void> {
  const ext = extname(filePath);
  const basePath = ext ? filePath.slice(0, -ext.length) : filePath;
  const hashFilePath = `${basePath}-hash.md`;
  const verifiedFilePath = `${basePath}-verified.md`;

  const storedHashRaw = await readFile(hashFilePath, "utf8");
  const storedHash = JSON.parse(storedHashRaw) as { merkleRoot: string };

  const { merkleRoot } = await calculateFileMerkleRoot(filePath);

  const verified = merkleRoot === storedHash.merkleRoot;

  await writeFile(verifiedFilePath, verified ? "VERIFIED" : "VERIFY FAILED");
}

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: npm run verify -- <path-to-file>");
    process.exitCode = 1;
    return;
  }

  await verifyFile(filePath);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred.";

  console.error(`Failed to verify file: ${message}`);
  process.exitCode = 1;
});
