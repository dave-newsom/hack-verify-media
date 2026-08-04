import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { SHA256_EMPTY, sha256, sha256Pair } from "../src/hash";

describe("sha256", () => {
  it("matches the empty-buffer digest", () => {
    const expected = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
    assert.equal(sha256(Buffer.alloc(0)).toString("hex"), expected);
    assert.equal(SHA256_EMPTY.toString("hex"), expected);
  });

  it("hashes arbitrary bytes", () => {
    const data = Buffer.from("hack-verify-media");
    const expected = createHash("sha256").update(data).digest("hex");
    assert.equal(sha256(data).toString("hex"), expected);
  });
});

describe("sha256Pair", () => {
  it("matches sha256 of concatenated buffers", () => {
    const left = Buffer.from("left-leaf-hash............");
    const right = Buffer.from("right-leaf-hash...........");
    const viaPair = sha256Pair(left, right).toString("hex");
    const viaConcat = sha256(Buffer.concat([left, right])).toString("hex");
    assert.equal(viaPair, viaConcat);
  });
});
