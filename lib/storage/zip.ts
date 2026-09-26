/**
 * Minimal ZIP parser — zero dependencies.
 * Reads the End-of-Central-Directory + Central Directory headers
 * and can extract stored (method 0) and deflated (method 8) entries.
 *
 * Server (Node): uses zlib.inflateRawSync.
 * Browser: uses DecompressionStream("deflate-raw") when available.
 */

export interface ZipEntryMeta {
  name: string;
  path: string;
  size: number;
  compressedSize: number;
  method: number;
  isDir: boolean;
  crc32: number;
  localHeaderOffset: number;
}

export interface ZipTree {
  entries: ZipEntryMeta[];
  totalFiles: number;
  totalDirs: number;
  totalUncompressed: number;
  truncated: boolean;
}

function readU16(view: DataView, off: number): number {
  return view.getUint16(off, true);
}
function readU32(view: DataView, off: number): number {
  return view.getUint32(off, true);
}

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

function findEocd(bytes: Uint8Array): number {
  // EOCD is within last 64KB + 22 bytes
  const min = Math.max(0, bytes.length - 65557 - 22);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

/** Parse central directory from a full ZIP buffer. Caps entries for safety. */
export function parseZipBuffer(
  input: Uint8Array | ArrayBuffer,
  maxEntries = 2000
): ZipTree {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOff = findEocd(bytes);
  if (eocdOff < 0) throw new Error("Not a valid ZIP archive (EOCD missing)");
  const cdCount = readU16(view, eocdOff + 10);
  const cdOffset = readU32(view, eocdOff + 16);
  const entries: ZipEntryMeta[] = [];
  let off = cdOffset;
  let totalUncompressed = 0;
  const count = Math.min(cdCount, maxEntries);
  for (let i = 0; i < count; i++) {
    if (off + 46 > bytes.length) break;
    if (readU32(view, off) !== CDH_SIG) break;
    const method = readU16(view, off + 10);
    const crc32 = readU32(view, off + 14);
    const compSize = readU32(view, off + 20);
    const size = readU32(view, off + 24);
    const nameLen = readU16(view, off + 28);
    const extraLen = readU16(view, off + 30);
    const commentLen = readU16(view, off + 32);
    const lho = readU32(view, off + 42);
    const nameBytes = bytes.subarray(off + 46, off + 46 + nameLen);
    let name = "";
    try {
      name = new TextDecoder().decode(nameBytes);
    } catch {
      name = Array.from(nameBytes).map((b) => String.fromCharCode(b)).join("");
    }
    const isDir = name.endsWith("/");
    entries.push({
      name: isDir ? name.slice(0, -1).split("/").pop() || name : name.split("/").pop() || name,
      path: name,
      size,
      compressedSize: compSize,
      method,
      isDir,
      crc32,
      localHeaderOffset: lho,
    });
    if (!isDir) totalUncompressed += size;
    off += 46 + nameLen + extraLen + commentLen;
  }
  // Sort: dirs first, then alpha
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
  return {
    entries,
    totalFiles: entries.filter((e) => !e.isDir).length,
    totalDirs: entries.filter((e) => e.isDir).length,
    totalUncompressed,
    truncated: cdCount > maxEntries,
  };
}

/** Locate raw entry data (compressed bytes + method) inside the buffer. */
export function getZipEntryRaw(
  input: Uint8Array | ArrayBuffer,
  entry: ZipEntryMeta
): { method: number; data: Uint8Array; size: number } {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const off = entry.localHeaderOffset;
  if (readU32(view, off) !== LFH_SIG) throw new Error("Corrupt ZIP local header");
  const method = readU16(view, off + 8);
  const nameLen = readU16(view, off + 26);
  const extraLen = readU16(view, off + 28);
  const start = off + 30 + nameLen + extraLen;
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw new Error("ZIP entry out of bounds");
  return { method, data: bytes.subarray(start, end), size: entry.size };
}

function inflateRawNode(data: Uint8Array): Uint8Array {
  // Lazy-require to keep browser bundles clean (server-only path)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const zlib = require("zlib") as typeof import("zlib");
    const out = zlib.inflateRawSync(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  } catch {
    throw new Error("Decompression unavailable in this browser for this entry");
  }
}

async function inflateRawBrowser(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Extract + decompress a single entry. Works in Node and modern browsers. */
export async function extractZipEntry(
  input: Uint8Array | ArrayBuffer,
  entry: ZipEntryMeta,
  maxBytes = 10 * 1024 * 1024
): Promise<Uint8Array> {
  if (entry.isDir) throw new Error("Cannot extract a directory");
  if (entry.size > maxBytes) throw new Error("Inner file too large to preview (10MB cap)");
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const raw = getZipEntryRaw(bytes, entry);
  if (raw.method === 0) {
    return raw.data.slice(0, maxBytes);
  }
  if (raw.method !== 8) throw new Error(`Unsupported compression method ${raw.method}`);
  if (typeof window === "undefined") {
    return inflateRawNode(raw.data).slice(0, maxBytes);
  }
  try {
    const out = await inflateRawBrowser(raw.data);
    return out.slice(0, maxBytes);
  } catch {
    return inflateRawNode(raw.data).slice(0, maxBytes);
  }
}

/** Build a nested folder tree for UI rendering. */
export interface ZipTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
  children: ZipTreeNode[];
  entry?: ZipEntryMeta;
}

export function buildZipTree(entries: ZipEntryMeta[]): ZipTreeNode[] {
  const root: ZipTreeNode[] = [];
  const dirMap = new Map<string, ZipTreeNode>();
  const ensureDir = (dirPath: string): ZipTreeNode => {
    const existing = dirMap.get(dirPath);
    if (existing) return existing;
    const parts = dirPath.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || dirPath;
    const node: ZipTreeNode = {
      name,
      path: dirPath,
      isDir: true,
      size: 0,
      compressedSize: 0,
      children: [],
    };
    dirMap.set(dirPath, node);
    if (parts.length > 1) {
      const parent = ensureDir(parts.slice(0, -1).join("/"));
      parent.children.push(node);
    } else {
      root.push(node);
    }
    return node;
  };
  for (const e of entries) {
    if (e.isDir) {
      ensureDir(e.path.replace(/\/$/, ""));
      continue;
    }
    const parts = e.path.split("/");
    if (parts.length > 1) {
      const parent = ensureDir(parts.slice(0, -1).join("/"));
      parent.children.push({
        name: e.name,
        path: e.path,
        isDir: false,
        size: e.size,
        compressedSize: e.compressedSize,
        children: [],
        entry: e,
      });
      parent.size += e.size;
    } else {
      root.push({
        name: e.name,
        path: e.path,
        isDir: false,
        size: e.size,
        compressedSize: e.compressedSize,
        children: [],
        entry: e,
      });
    }
  }
  const sortRec = (nodes: ZipTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(root);
  return root;
}
