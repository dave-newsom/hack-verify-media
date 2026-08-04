# hack-verify-media

Prove that media captured on an edge unit arrives in the cloud untampered.

## Premise

1. **Edge** — When a unit records media, it hashes the file (chunked SHA-256 → Merkle root) and keeps that digest as the unit’s integrity claim for the capture.
2. **Cloud** — On upload (for example through Mediator or a similar service), the same hashing is run again against the received bytes.
3. **Ledger** — If the cloud hash matches the edge hash, the digest can be signed and written to a blockchain ledger. A match means the bytes were not altered in transit; the ledger anchors that claim to a specific unit and time.

This repository is a **demo** of the hash and verify steps. It does not implement Mediator upload or ledger signing yet—only the integrity math you would run on the edge and again in the cloud.

### Current flow

Edge uploads media and a separate notice; Mediator forwards the notice for hydration. There is no integrity check against the object in S3.

```mermaid
sequenceDiagram
  participant Edge
  participant S3
  participant Mediator
  participant Hydration

  Edge->>S3: Push video
  Edge->>Mediator: Notice (deterrent or alert)
  Mediator->>Hydration: Forward notice
```

### Target flow

Edge builds a Merkle manifest first, then uploads the video and includes that manifest with the Mediator notice. Mediator verifies the S3 object against the manifest; on success it signs the digest to the ledger. The alert/notice path continues as today.

```mermaid
sequenceDiagram
  participant Edge
  participant S3
  participant Mediator
  participant Ledger
  participant Hydration

  Edge->>Edge: Produce Merkle manifest
  Edge->>S3: Push video
  Edge->>Mediator: Notice plus Merkle manifest
  Mediator->>S3: Fetch video bytes
  Mediator->>Mediator: Verify hash vs manifest
  alt Manifest matches S3 object
    Mediator->>Ledger: Sign digest to ledger
  else Tamper or mismatch
    Mediator-->>Mediator: Reject integrity claim
  end
  Mediator->>Hydration: Forward notice as normal
```

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
| `npm run hash -- <file> [chunk-size-bytes]` | Hash a media file; print Merkle JSON and write `<file>-hash.md` |
| `npm run verify -- <file>` | Re-hash `<file>`, compare to `<file>-hash.md`, write `<file>-verified.md` |
| `npm run test` | Unit tests + loose timing/resource checks |
| `npm run bench` | Print wall/CPU/memory table for synthetic sizes (and Chaplin if present) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start -- hash \| verify …` | Run the compiled CLI the same way |

Default chunk size is `262144` (256 KiB). Override on hash with a trailing byte size, for example `1048576` for 1 MiB.

`verify` exits `0` on success and `1` on mismatch or error.

### Hash output shape

```json
{
  "chunkSize": 262144,
  "chunkCount": 5,
  "merkleRoot": "…"
}
```

Lean on purpose: no per-chunk hex list (saves RAM/disk on device). `hash` writes that JSON to `<file>-hash.md` for verify.

## Demo

```bash
npm run -s hash -- fixtures/media/chaplin_laughing_gas.mp4
npm run -s verify -- fixtures/media/chaplin_laughing_gas.mp4
# → chaplin_laughing_gas-verified.md contains VERIFIED
```

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
  verify.ts       verifyFile (-hash.md → -verified.md)
  main.ts         CLI: hash | verify
fixtures/         Sample media and golden roots
scripts/          Fixture download / edit helpers
```
