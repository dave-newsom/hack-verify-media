# hack-verify-media

Prove that media captured on an edge unit arrives in the cloud untampered.

## Premise

1. **Edge** — When a unit records media, it hashes the file (chunked SHA-256 → Merkle root) and keeps that digest as the unit’s integrity claim for the capture.
2. **Cloud** — On upload (for example through Mediator or a similar service), the same hashing is run again against the received bytes.
3. **Ledger** — If the cloud hash matches the edge hash, the digest can be signed and written to a blockchain ledger. A match means the bytes were not altered in transit; the ledger anchors that claim to a specific unit and time.

This repository is a **demo** of the hash and verify steps. It does not implement Mediator upload or ledger signing yet—only the integrity math you would run on the edge and again in the cloud.

## How hashing works

- Split the file into fixed-size chunks (default **256 KiB**; last chunk may be shorter).
- SHA-256 each chunk (leaf hashes).
- Build a binary **Merkle tree** over those leaves (odd nodes are duplicated) and take the root.

Verification re-hashes a file with the same chunk size recorded in the expected Merkle JSON and compares. A mismatch fails verification and reports which chunk indices differ.

## Setup

```bash
npm install
```

Optional: rebuild sample videos under `fixtures/media/` (needs `curl`, `ffmpeg`, `python3`):

```bash
npm run fixtures:fetch
```

See [fixtures/README.md](fixtures/README.md) for fixture details and licenses.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run hash -- <file> [chunk-size-bytes]` | Hash a media file; print Merkle JSON to stdout |
| `npm run verify -- <file> <expected.json>` | Hash `<file>` (using `chunkSize` from expected JSON) and check it |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start -- hash \| verify …` | Run the compiled CLI the same way |

Default chunk size is `262144` (256 KiB). Override on hash with a trailing byte size, for example `1048576` for 1 MiB. `verify` always uses the `chunkSize` stored in the expected JSON so edge and cloud stay aligned.

`verify` exits `0` when `matched` is true, and `1` on mismatch or error.

### Hash output shape

```json
{
  "chunkSize": 262144,
  "chunkCount": 5,
  "chunkHashes": ["…", "…"],
  "merkleRoot": "…"
}
```

Save that JSON as the “expected” digest from the edge. Cloud verify loads it and compares against a fresh hash of the uploaded file.

## Demo

Hash a clean fixture (edge), then verify the same file and a tampered copy (cloud):

```bash
npm run -s hash -- fixtures/media/chaplin_laughing_gas.mp4 > expected.json

# Same bytes → match
npm run -s verify -- fixtures/media/chaplin_laughing_gas.mp4 expected.json

# One chunk edited → fail; changedChunkIndices includes 2
npm run -s verify -- fixtures/media/chaplin_laughing_gas_edit_chunk2.mp4 expected.json
```

Untampered verify prints `matched: true`. The edited file prints `matched: false` and which leaf hashes changed, so you can see that only the tampered chunk fails while others still match.

Larger chunks (for example 1 MiB):

```bash
npm run -s hash -- fixtures/media/chaplin_laughing_gas.mp4 1048576
```

## Project layout

```text
src/
  hash.ts         SHA-256 helper
  chunks.ts       Exact file chunk hashing (default 256 KiB)
  merkle.ts       Merkle root over leaf hashes
  fileMerkle.ts   Orchestrate file → MerkleResult
  verify.ts       Compare actual vs expected Merkle JSON
  main.ts         CLI: hash | verify
fixtures/         Sample media and golden roots
scripts/          Fixture download / edit helpers
```
