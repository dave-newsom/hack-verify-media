/**
 * Append-only, hash-chained ledger of Merkle roots (local prototype).
 *
 * Each block links to the previous one via prevHash, and its own blockHash is a
 * SHA-256 over the block's contents. Rewriting any block breaks the chain, which
 * validateChain() detects. This is tamper-EVIDENT, not tamper-proof: an operator
 * with write access to the ledger file can rebuild the whole chain. To become
 * tamper-proof, periodically commit the head hash to a public chain via the
 * Anchor seam below (no-op locally).
 *
 * CLI:
 *   npm run ledger -- append <path-to-file>   # hash the file + append a block
 *   npm run ledger -- list [--full]           # show the chain (block explorer)
 *   npm run ledger -- validate                # verify chain integrity (exit 1 if broken)
 *   npm run ledger -- tamper <index>          # DEMO ONLY: corrupt a block to show detection
 *
 * Ledger file defaults to ./ledger.json; override with LEDGER_PATH.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import { calculateFileMerkleRoot } from "./fileMerkle";

const GENESIS_PREV_HASH = "0".repeat(64);
const LEDGER_PATH = process.env.LEDGER_PATH ?? "ledger.json";

export interface LedgerBlock {
  index: number;
  mediaId: string;
  merkleRoot: string;
  timestampMs: number;
  prevHash: string;
  blockHash: string;
}

/**
 * Seam for a future production upgrade: commit the ledger head to an external,
 * append-only source of truth (OpenTimestamps, Hedera, an EVM L2, ...). Swapping
 * NoopAnchor for a real implementation is what turns this into a tamper-PROOF
 * ledger — no changes to the ledger core required.
 */
export interface Anchor {
  commit(headHash: string): Promise<string>; // returns a proof / txId
}

export class NoopAnchor implements Anchor {
  async commit(_headHash: string): Promise<string> {
    return "local-only";
  }
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function computeBlockHash(block: Omit<LedgerBlock, "blockHash">): string {
  return sha256Hex(
    JSON.stringify({
      index: block.index,
      mediaId: block.mediaId,
      merkleRoot: block.merkleRoot,
      timestampMs: block.timestampMs,
      prevHash: block.prevHash,
    }),
  );
}

export async function loadLedger(path = LEDGER_PATH): Promise<LedgerBlock[]> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as LedgerBlock[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveLedger(chain: LedgerBlock[], path = LEDGER_PATH): Promise<void> {
  await writeFile(path, `${JSON.stringify(chain, null, 2)}\n`);
}

/** The current head hash — commits to the entire chain up to this point. */
export function headHash(chain: LedgerBlock[]): string {
  return chain.length === 0 ? GENESIS_PREV_HASH : chain[chain.length - 1].blockHash;
}

export async function appendRoot(
  mediaId: string,
  merkleRoot: string,
  path = LEDGER_PATH,
): Promise<LedgerBlock> {
  const chain = await loadLedger(path);

  const partial: Omit<LedgerBlock, "blockHash"> = {
    index: chain.length,
    mediaId,
    merkleRoot,
    timestampMs: Date.now(),
    prevHash: headHash(chain),
  };

  const block: LedgerBlock = { ...partial, blockHash: computeBlockHash(partial) };
  chain.push(block);
  await saveLedger(chain, path);

  return block;
}

export interface ValidationResult {
  valid: boolean;
  length: number;
  brokenAtIndex?: number;
  reason?: string;
}

export function validateChain(chain: LedgerBlock[]): ValidationResult {
  for (let i = 0; i < chain.length; i += 1) {
    const block = chain[i];

    if (block.index !== i) {
      return { valid: false, length: chain.length, brokenAtIndex: i, reason: `index mismatch: expected ${i}, got ${block.index}` };
    }

    const expectedPrev = i === 0 ? GENESIS_PREV_HASH : chain[i - 1].blockHash;
    if (block.prevHash !== expectedPrev) {
      return { valid: false, length: chain.length, brokenAtIndex: i, reason: `prevHash does not point to previous block` };
    }

    const recomputed = computeBlockHash({
      index: block.index,
      mediaId: block.mediaId,
      merkleRoot: block.merkleRoot,
      timestampMs: block.timestampMs,
      prevHash: block.prevHash,
    });
    if (recomputed !== block.blockHash) {
      return { valid: false, length: chain.length, brokenAtIndex: i, reason: `blockHash mismatch — block contents were altered` };
    }
  }

  return { valid: true, length: chain.length };
}

// ---------------------------------------------------------------------------
// CLI / demo renderer
// ---------------------------------------------------------------------------

const useColor = process.stdout.isTTY === true;
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  cyan: paint("36"),
};

function short(hash: string): string {
  return hash.length <= 20 ? hash : `${hash.slice(0, 10)}…${hash.slice(-10)}`;
}

function renderBlock(b: LedgerBlock, full: boolean): string[] {
  const fmt = (h: string) => (full ? h : short(h));
  return [
    c.cyan(`┌─ block #${b.index} ${"─".repeat(48)}`),
    `│ ${c.bold("media")}      ${b.mediaId}`,
    `│ ${c.bold("root")}       ${b.merkleRoot === "" ? c.dim("(none)") : fmt(b.merkleRoot)}`,
    `│ ${c.bold("time")}       ${new Date(b.timestampMs).toISOString()}`,
    `│ ${c.bold("prevHash")}   ${c.dim(fmt(b.prevHash))}`,
    `│ ${c.bold("blockHash")}  ${fmt(b.blockHash)}`,
    c.cyan("└" + "─".repeat(58)),
  ];
}

function renderChain(chain: LedgerBlock[], full: boolean): string {
  if (chain.length === 0) {
    return c.dim("(ledger is empty — run: npm run ledger -- append <file>)");
  }

  const lines: string[] = [];
  chain.forEach((b, i) => {
    if (i > 0) lines.push(c.dim("     ↑ prevHash links to the block above"));
    lines.push(...renderBlock(b, full));
  });

  return lines.join("\n");
}

async function printLedger(path: string, full: boolean): Promise<void> {
  const chain = await loadLedger(path);
  const result = validateChain(chain);
  const status = result.valid
    ? c.green("✅ chain valid")
    : c.red(`❌ chain INVALID at block #${result.brokenAtIndex}: ${result.reason}`);

  console.log(`${c.bold("Ledger")} ${c.dim(path)}  ·  ${chain.length} block(s)  ·  ${status}\n`);
  console.log(renderChain(chain, full));
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  const full = process.argv.includes("--full");
  const path = LEDGER_PATH;

  switch (command) {
    case "append": {
      if (!arg) {
        console.error("Usage: npm run ledger -- append <path-to-file>");
        process.exitCode = 1;
        return;
      }
      const { merkleRoot } = await calculateFileMerkleRoot(arg);
      const block = await appendRoot(basename(arg), merkleRoot, path);
      const chain = await loadLedger(path);
      const result = validateChain(chain);

      console.log();
      console.log(c.green(`⛓  NEW BLOCK #${block.index} appended`) + c.dim(`  →  ${path}`));
      console.log(renderBlock(block, full).join("\n"));
      console.log(
        `   ${c.dim("chain height")} ${chain.length}` +
          `   ${c.dim("anchor")} local-only` +
          `   ${result.valid ? c.green("✅ chain valid") : c.red(`❌ ${result.reason}`)}`,
      );
      console.log();
      return;
    }

    case "list":
    case "show": {
      await printLedger(path, full);
      return;
    }

    case "validate": {
      const result = validateChain(await loadLedger(path));
      if (result.valid) {
        console.log(c.green(`✅ chain valid — ${result.length} block(s)`));
      } else {
        console.log(c.red(`❌ chain INVALID at block #${result.brokenAtIndex}: ${result.reason}`));
        process.exitCode = 1;
      }
      return;
    }

    case "tamper": {
      // DEMO ONLY: alter a stored root without recomputing hashes, so validate()
      // catches it — illustrating the tamper-evidence property.
      const index = Number(arg);
      const chain = await loadLedger(path);
      if (!Number.isInteger(index) || index < 0 || index >= chain.length) {
        console.error(`Usage: npm run ledger -- tamper <index 0..${chain.length - 1}>`);
        process.exitCode = 1;
        return;
      }
      const target = chain[index];
      const original = target.merkleRoot;
      target.merkleRoot = (original[0] === "0" ? "1" : "0") + original.slice(1);
      await saveLedger(chain, path);
      console.log(c.red(`Tampered block #${index}: flipped a byte of its root.`));
      console.log(c.dim(`  before ${short(original)}`));
      console.log(c.dim(`  after  ${short(target.merkleRoot)}`));
      console.log(`Now run: ${c.bold("npm run ledger -- validate")}`);
      return;
    }

    default:
      console.error(
        [
          "Usage:",
          "  npm run ledger -- append <path-to-file>   hash a file + append a block",
          "  npm run ledger -- list [--full]           show the chain",
          "  npm run ledger -- validate                verify chain integrity",
          "  npm run ledger -- tamper <index>          DEMO: corrupt a block",
        ].join("\n"),
      );
      process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error occurred.";
    console.error(`Ledger error: ${message}`);
    process.exitCode = 1;
  });
}
