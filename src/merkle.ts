import { sha256 } from "./hash";

function combineHashes(left: Buffer, right: Buffer): Buffer {
  return sha256(Buffer.concat([left, right]));
}

export function buildMerkleRoot(leafHashes: Buffer[]): Buffer {
  if (leafHashes.length === 0) {
    throw new Error("Cannot build a Merkle root with no leaves.");
  }

  let currentLevel: Buffer[] = leafHashes.map((hash) => Buffer.from(hash));

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
