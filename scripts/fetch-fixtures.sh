#!/usr/bin/env bash
# Download work-appropriate PD/CC clips, size them for Merkle tests, and
# build per-chunk edit variants for integrity demos.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/fixtures/media"
CACHE="$ROOT/fixtures/.cache"
CHUNK_SIZE=$((1024 * 1024)) # 1 MiB (matches src/main.ts)
MIB_1=$CHUNK_SIZE
MIB_2=$((CHUNK_SIZE * 2))
MIB_5=$((CHUNK_SIZE * 5))

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need curl
need ffmpeg
need python3

mkdir -p "$OUT" "$CACHE"

download() {
  local url="$1"
  local dest="$2"
  if [[ -f "$dest" && -s "$dest" ]]; then
    echo "Cached: $dest"
    return
  fi
  echo "Downloading: $url"
  curl -fL --retry 3 --retry-delay 2 -o "$dest.partial" "$url"
  mv "$dest.partial" "$dest"
}

# Re-encode a time window to H.264 MP4.
# target_bytes:
#   0     -> keep natural encode size (must already satisfy caller's chunk needs)
#   >0    -> pad with zeros or truncate to exact length (for Merkle size cases)
encode_window() {
  local src="$1"
  local dest="$2"
  local start="$3"
  local duration="$4"
  local target_bytes="$5"
  local crf="${6:-23}"
  local tmp="$dest.tmp.mp4"

  ffmpeg -y -hide_banner -loglevel error \
    -ss "$start" -t "$duration" -i "$src" \
    -vf "scale=640:-2" -c:v libx264 -preset fast -crf "$crf" \
    -an -movflags +faststart \
    "$tmp"

  python3 - "$tmp" "$dest" "$target_bytes" <<'PY'
import sys
from pathlib import Path

src, dest, target = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
data = bytearray(src.read_bytes())
if target > 0:
    if len(data) > target:
        data = data[:target]
    elif len(data) < target:
        data.extend(b"\x00" * (target - len(data)))
dest.write_bytes(data)
src.unlink(missing_ok=True)
print(f"Wrote {dest} ({len(data)} bytes)")
PY
}

# XOR a few bytes inside one 1 MiB chunk window (does not re-encode).
edit_chunk() {
  local src="$1"
  local dest="$2"
  local chunk_index="$3"

  python3 - "$src" "$dest" "$chunk_index" "$CHUNK_SIZE" <<'PY'
import sys
from pathlib import Path

src, dest = Path(sys.argv[1]), Path(sys.argv[2])
chunk_index = int(sys.argv[3])
chunk_size = int(sys.argv[4])
data = bytearray(src.read_bytes())
size = len(data)
start = chunk_index * chunk_size
if start >= size:
    raise SystemExit(f"Chunk {chunk_index} starts past EOF ({size} bytes)")
# Flip 16 bytes near the middle of the chunk window (or whatever remains).
offset = start + min(chunk_size // 2, max(0, size - start - 1))
end = min(offset + 16, size)
for i in range(offset, end):
    data[i] ^= 0xFF
dest.write_bytes(data)
print(f"Wrote {dest.name}: XOR in chunk {chunk_index} at byte offset {offset}")
PY
}

echo "==> Fetching sources"
download \
  "https://archive.org/download/SteamboatWillie/Steamboat%20Willie.mp4" \
  "$CACHE/steamboat_willie_src.mp4"
download \
  "https://archive.org/download/CopyingIsNotTheft1080p/CopyingIsNotTheft_nik_1080p.mp4" \
  "$CACHE/copying_is_not_theft_src.mp4"
download \
  "https://archive.org/download/big-buck-bunny-512kb_202603/BigBuckBunny_512kb.mp4" \
  "$CACHE/bbb_src.mp4"
download \
  "https://archive.org/download/CC_1914_07_09_LaffingGas/CC_1914_07_09_LaffingGas_512kb.mp4" \
  "$CACHE/chaplin_src.mp4"

echo "==> Building sized fixtures"
: > "$OUT/empty.mp4"

# Archive copy has ~6.4s black leader + titles; steamboat action is clear by ~22s.
# Keep natural size under 1 MiB (single chunk). Do not zero-pad (breaks some players).
encode_window "$CACHE/steamboat_willie_src.mp4" "$OUT/steamboat_willie.mp4" 22 7 0 28

# Full minute meme, forced to exact 1 MiB (exact one-chunk boundary).
encode_window "$CACHE/copying_is_not_theft_src.mp4" "$OUT/copying_is_not_theft.mp4" 0 60 "$MIB_1" 28

# Slapstick stretch ~ mid film; size into (1 MiB, 2 MiB] => 2 chunks.
# ~2:00 into BBB has the rodent / slingshot mayhem.
encode_window "$CACHE/bbb_src.mp4" "$OUT/bbb_slapstick.mp4" 120 20 $((MIB_1 + MIB_1 / 2)) 28

# Chaplin slapstick sized to exactly 5 MiB => 5 chunks (odd leaf count).
encode_window "$CACHE/chaplin_src.mp4" "$OUT/chaplin_laughing_gas.mp4" 0 90 "$MIB_5" 28

echo "==> Demo clip + simple tamper"
cp "$OUT/steamboat_willie.mp4" "$OUT/demo_clip.mp4"
python3 - "$OUT/demo_clip.mp4" "$OUT/demo_clip_tampered.mp4" <<'PY'
import sys
from pathlib import Path
src, dest = Path(sys.argv[1]), Path(sys.argv[2])
data = bytearray(src.read_bytes())
if not data:
    raise SystemExit("demo_clip is empty")
# Flip near the end so early frames often still decode in players.
offset = max(0, len(data) - 64)
data[offset] ^= 0xFF
dest.write_bytes(data)
print(f"Wrote {dest.name}: flipped byte at offset {offset}")
PY

echo "==> Per-chunk edit variants (Chaplin 5 MiB base)"
edit_chunk "$OUT/chaplin_laughing_gas.mp4" "$OUT/chaplin_laughing_gas_edit_chunk0.mp4" 0
edit_chunk "$OUT/chaplin_laughing_gas.mp4" "$OUT/chaplin_laughing_gas_edit_chunk2.mp4" 2
edit_chunk "$OUT/chaplin_laughing_gas.mp4" "$OUT/chaplin_laughing_gas_edit_chunk4.mp4" 4

echo "==> Fixture sizes"
python3 - "$OUT" "$CHUNK_SIZE" <<'PY'
from pathlib import Path
import sys
out = Path(sys.argv[1])
chunk = int(sys.argv[2])
for path in sorted(out.glob("*.mp4")):
    size = path.stat().st_size
    chunks = 1 if size == 0 else (size + chunk - 1) // chunk
    print(f"  {path.name:42} {size:10} bytes  (~{chunks} chunk(s))")
PY

echo "Done. Sources cached in fixtures/.cache (gitignored)."
echo "Run: npm run -s merkle -- fixtures/media/chaplin_laughing_gas.mp4"
