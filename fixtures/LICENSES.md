# Fixture media licenses and attribution

These clips are work-appropriate public-domain or Creative Commons shorts used
only as Merkle / integrity test fixtures. Short extracts may be re-encoded and
byte-padded for exact chunk sizes; see `fixtures/README.md`.

## Steamboat Willie (1928)

- **File:** `media/steamboat_willie.mp4`, `media/demo_clip.mp4`
- **Source:** https://archive.org/details/SteamboatWillie
- **License:** Public Domain Mark 1.0 (US public domain as of 2024-01-01)
- **Notes:** Extract starts after the Archive copy’s black leader/titles (~22s), steamboat action. Kept under 1 MiB without zero-padding.

## Copying Is Not Theft (Minute Meme #1)

- **File:** `media/copying_is_not_theft.mp4`
- **Authors:** Animation/lyrics/tune by Nina Paley; music arranged by Nik Phelps; vocals by Connie Champagne (QuestionCopyright.org)
- **Source:** https://archive.org/details/CopyingIsNotTheft1080p
- **License:** [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- **Attribution:** "Copying Is Not Theft" by Nina Paley / QuestionCopyright.org, CC BY-SA 3.0

## Big Buck Bunny

- **File:** `media/bbb_slapstick.mp4`
- **Author:** Blender Foundation / Peach Open Movie Project
- **Source download used:** https://archive.org/details/big-buck-bunny-512kb_202603
- **Canonical license:** [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (Blender Foundation)
- **Attribution:** (c) copyright Blender Foundation | www.bigbuckbunny.org
- **Notes:** Mid-film slapstick extract, re-encoded and sized for a 2-chunk Merkle case.

## Charlie Chaplin — Laughing Gas (1914)

- **File:** `media/chaplin_laughing_gas.mp4` and `media/chaplin_laughing_gas_edit_chunk{0,2,4}.mp4`
- **Source:** https://archive.org/details/CC_1914_07_09_LaffingGas
- **License:** Public Domain
- **Notes:** Extract sized to exactly 5 MiB (5 × 1 MiB chunks). Edit variants XOR bytes inside a single chunk window for integrity demos; they are derived fixtures, not separate works.

## Empty / derived fixtures

- `media/empty.mp4` — empty file for the zero-byte Merkle leaf path (not a licensed work).
- `media/demo_clip_tampered.mp4` — one-byte flip of `demo_clip.mp4` for a quick root-diff demo.
