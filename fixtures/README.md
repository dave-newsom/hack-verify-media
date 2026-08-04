# Media fixtures

Work-appropriate, clearly licensed short videos for testing SHA-256 chunk hashing and Merkle roots (`src/`).

Default chunk size is **256 KiB** (`262144` bytes). Regenerate (requires `curl`, `ffmpeg`, `python3`):

```bash
npm run fixtures:fetch
```

Source downloads are cached under `fixtures/.cache/` (gitignored). Committed outputs live in `fixtures/media/`. After a fresh fetch, fixtures are sized as multiples of the default chunk size (1 / 2 / 5 chunks, etc.).

## Files

| File | Role |
|------|------|
| `empty.mp4` | 0-byte leaf special case |
| `steamboat_willie.mp4` | Fun PD cartoon extract; preferably ≤ 1 chunk |
| `copying_is_not_theft.mp4` | Nina Paley minute meme; exact 1-chunk boundary when regenerated |
| `bbb_slapstick.mp4` | Big Buck Bunny slapstick; 2-chunk case when regenerated |
| `chaplin_laughing_gas.mp4` | Chaplin slapstick; **5 chunks** when regenerated (odd Merkle leaf count) |
| `chaplin_laughing_gas_edit_chunk0.mp4` | Same as Chaplin, bytes changed **only in chunk 0** |
| `chaplin_laughing_gas_edit_chunk2.mp4` | Same as Chaplin, bytes changed **only in chunk 2** |
| `chaplin_laughing_gas_edit_chunk4.mp4` | Same as Chaplin, bytes changed **only in chunk 4** |
| `demo_clip.mp4` | Stable hero path (copy of Steamboat extract) |
| `demo_clip_tampered.mp4` | One mid-file byte flipped vs `demo_clip.mp4` |

See [LICENSES.md](./LICENSES.md) for attribution.

## Chunk-edit demo

```bash
npm run -s hash -- fixtures/media/chaplin_laughing_gas.mp4
npm run -s verify -- fixtures/media/chaplin_laughing_gas.mp4
# → chaplin_laughing_gas-verified.md = VERIFIED
```

Golden `merkleRoot` values for each committed fixture are in [`expected-roots.json`](./expected-roots.json).
