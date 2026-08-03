# Media fixtures

Work-appropriate, clearly licensed short videos for testing SHA-256 chunk hashing and Merkle roots (`src/main.ts`).

Regenerate (requires `curl`, `ffmpeg`, `python3`):

```bash
npm run fixtures:fetch
```

Source downloads are cached under `fixtures/.cache/` (gitignored). Committed outputs live in `fixtures/media/`.

## Files

| File | Role |
|------|------|
| `empty.mp4` | 0-byte leaf special case |
| `steamboat_willie.mp4` | Fun PD cartoon extract; single chunk (&lt; 1 MiB) |
| `copying_is_not_theft.mp4` | Nina Paley minute meme; exact 1 MiB (1 chunk) |
| `bbb_slapstick.mp4` | Big Buck Bunny slapstick; 2 chunks |
| `chaplin_laughing_gas.mp4` | Chaplin slapstick; **5 MiB / 5 chunks** (odd Merkle leaf count) |
| `chaplin_laughing_gas_edit_chunk0.mp4` | Same as Chaplin, bytes changed **only in chunk 0** |
| `chaplin_laughing_gas_edit_chunk2.mp4` | Same as Chaplin, bytes changed **only in chunk 2** |
| `chaplin_laughing_gas_edit_chunk4.mp4` | Same as Chaplin, bytes changed **only in chunk 4** |
| `demo_clip.mp4` | Stable hero path (copy of Steamboat extract) |
| `demo_clip_tampered.mp4` | One mid-file byte flipped vs `demo_clip.mp4` |

See [LICENSES.md](./LICENSES.md) for attribution.

## Chunk-edit demo

Show that tampering one chunk changes only that leaf hash (and the Merkle root):

```bash
npm run -s merkle -- fixtures/media/chaplin_laughing_gas.mp4 > /tmp/orig.json
npm run -s merkle -- fixtures/media/chaplin_laughing_gas_edit_chunk2.mp4 > /tmp/edit.json
npm run -s compare-chunks -- /tmp/orig.json /tmp/edit.json
```


Expected: `changedChunkIndices: [2]`, other indices unchanged, `merkleRootChanged: true`.

Try `edit_chunk0` or `edit_chunk4` the same way to see different indices light up.

Golden `merkleRoot` values for each committed fixture are in [`expected-roots.json`](./expected-roots.json).
