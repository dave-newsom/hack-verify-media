import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sha256, sha256Pair } from "../src/hash";
import { buildMerkleRoot } from "../src/merkle";

describe("buildMerkleRoot", () => {
  it("rejects an empty leaf list", () => {
    assert.throws(() => buildMerkleRoot([]), /no leaves/);
  });

  it("returns the single leaf as the root", () => {
    const leaf = sha256(Buffer.from("only"));
    const root = buildMerkleRoot([Buffer.from(leaf)]);
    assert.equal(root.toString("hex"), leaf.toString("hex"));
  });

  it("pairs two leaves", () => {
    const left = sha256(Buffer.from("a"));
    const right = sha256(Buffer.from("b"));
    const root = buildMerkleRoot([Buffer.from(left), Buffer.from(right)]);
    assert.equal(root.toString("hex"), sha256Pair(left, right).toString("hex"));
  });

  it("duplicates the final leaf when the count is odd", () => {
    const a = sha256(Buffer.from("a"));
    const b = sha256(Buffer.from("b"));
    const c = sha256(Buffer.from("c"));

    const ab = sha256Pair(a, b);
    const cc = sha256Pair(c, c);
    const expected = sha256Pair(ab, cc);

    const root = buildMerkleRoot([
      Buffer.from(a),
      Buffer.from(b),
      Buffer.from(c),
    ]);
    assert.equal(root.toString("hex"), expected.toString("hex"));
  });
});
