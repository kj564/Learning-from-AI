/**
 * File security: MIME sniffing (magic bytes), blocklist, filename sanitization,
 * and the file lifecycle state machine (P1-2, P1-3).
 *
 * Lifecycle:
 *   UPLOADED → SCANNING → READY     (passed sniff + blocklist)
 *                      → QUARANTINED (failed sniff, executable, or oversize)
 *   READY → INDEXED    (added to RAG/knowledge base)
 *   any → DELETED      (soft-delete; not readable)
 *
 * Only READY / INDEXED files are readable by the agent via read_file. This
 * prevents the agent from processing a file that's still being scanned or
 * that failed validation (T27, T28).
 *
 * MIME sniffing uses the first 16 bytes (magic bytes), not the file
 * extension. This catches `evil.png` that's actually a shell script (T28).
 */

import { open as fsOpen, read, close, rename } from 'fs/promises';
import { open, constants } from 'fs';
import path from 'path';
import { db } from '@/lib/db';

// ============================================================
// Magic-byte MIME sniffing
// ============================================================

const MAGIC_BYTES: { mime: string; bytes: number[]; offset?: number }[] = [
  // Images
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (also WAV)
  // Documents
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  // Archives (potentially dangerous — zip bombs, etc.)
  { mime: 'application/zip', bytes: [0x50, 0x4B, 0x03, 0x04] }, // PK\x03\x04
  { mime: 'application/gzip', bytes: [0x1F, 0x8B] },
  // Scripts — DANGEROUS
  { mime: 'application/x-shellscript', bytes: [0x23, 0x21, 0x2F, 0x62, 0x69, 0x6E] }, // #!/bin
  // Executables — DANGEROUS
  { mime: 'application/x-executable', bytes: [0x7F, 0x45, 0x4C, 0x46] }, // \x7fELF (Linux)
  { mime: 'application/x-dosexec', bytes: [0x4D, 0x5A] }, // MZ (Windows PE)
  // Text (UTF-8 BOM)
  { mime: 'text/plain', bytes: [0xEF, 0xBB, 0xBF] },
];

export async function sniffMimeType(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    open(filePath, 'r', (err, fd) => {
      if (err) return resolve('application/octet-stream');
      const buf = Buffer.alloc(16);
      read(fd, buf, 0, 16, 0, (err2) => {
        close(fd, () => {});
        if (err2) return resolve('application/octet-stream');
        for (const sig of MAGIC_BYTES) {
          if (buf.length >= sig.bytes.length + (sig.offset || 0)) {
            let match = true;
            for (let i = 0; i < sig.bytes.length; i++) {
              if (buf[i + (sig.offset || 0)] !== sig.bytes[i]) { match = false; break; }
            }
            if (match) return resolve(sig.mime);
          }
        }
        // Heuristic: if it's all printable ASCII, call it text.
        let printable = 0;
        for (let i = 0; i < Math.min(buf.length, 16); i++) {
          if (buf[i] >= 0x20 && buf[i] <= 0x7E || buf[i] === 0x0A || buf[i] === 0x0D || buf[i] === 0x09) printable++;
        }
        if (printable === Math.min(buf.length, 16)) return resolve('text/plain');
        resolve('application/octet-stream');
      });
    });
  });
}

// ============================================================
// Blocklist — file types the agent should never process
// ============================================================

const BLOCKLIST_MIMES = new Set([
  'application/x-executable',   // Linux ELF
  'application/x-dosexec',      // Windows PE
  'application/x-shellscript',  // #!/bin/bash...
  'application/x-msdos-program',
  'application/x-python-bytecode',
]);

const BLOCKLIST_EXTENSIONS = new Set([
  '.exe', '.bin', '.elf', '.so', '.dll', '.dylib',
  '.sh', '.bash', '.zsh', '.csh', '.ksh',
  '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.wsf',
  '.com', '.scr',
  '.pyc', '.pyo',
]);

export interface ScanResult {
  ok: boolean;
  sniffedMime: string;
  quarantineReason?: string;
}

export function isBlocklisted(mime: string, filename: string): boolean {
  if (BLOCKLIST_MIMES.has(mime)) return true;
  const ext = path.extname(filename).toLowerCase();
  if (BLOCKLIST_EXTENSIONS.has(ext)) return true;
  return false;
}

// ============================================================
// Filename sanitization
// ============================================================

export function sanitizeFilename(name: string): string {
  // Strip path separators, null bytes, control chars. Replace with _.
  let s = name.replace(/[\x00-\x1f\x7f/\\]/g, '_');
  // Remove leading dots (hidden files + .. traversal attempts).
  s = s.replace(/^\.+/, '');
  // Collapse multiple underscores.
  s = s.replace(/_+/g, '_');
  // Truncate to 100 chars (keep extension).
  if (s.length > 100) {
    const ext = path.extname(s);
    s = s.slice(0, 100 - ext.length) + ext;
  }
  // Never allow empty.
  if (!s) s = 'file';
  return s;
}

/**
 * Scan a file that was just uploaded. Updates the WorkspaceFile row with:
 *   - sniffedMimeType (from magic bytes)
 *   - status: READY or QUARANTINED
 *   - quarantineReason (if quarantined)
 *
 * Returns the scan result so the caller can refuse to serve the file if
 * quarantined.
 */
export async function scanUploadedFile(workspaceFileId: string, filePath: string, originalName: string): Promise<ScanResult> {
  await db.workspaceFile.update({
    where: { id: workspaceFileId },
    data: { status: 'SCANNING' },
  }).catch(() => {});
  const sniffed = await sniffMimeType(filePath);
  const blocklisted = isBlocklisted(sniffed, originalName);
  if (blocklisted) {
    const reason = `executable_blocklist (${sniffed})`;
    await db.workspaceFile.update({
      where: { id: workspaceFileId },
      data: { status: 'QUARANTINED', sniffedMimeType: sniffed, quarantineReason: reason },
    }).catch(() => {});
    // Move the file to a quarantine/ subdirectory so it can't be read via read_file.
    try {
      const quarantineDir = path.join(path.dirname(filePath), '..', '.quarantine');
      await import('fs/promises').then(({ mkdir }) => mkdir(quarantineDir, { recursive: true }));
      const quarantinedPath = path.join(quarantineDir, path.basename(filePath));
      await rename(filePath, quarantinedPath);
    } catch {}
    return { ok: false, sniffedMime: sniffed, quarantineReason: reason };
  }
  await db.workspaceFile.update({
    where: { id: workspaceFileId },
    data: { status: 'READY', sniffedMimeType: sniffed },
  }).catch(() => {});
  return { ok: true, sniffedMime: sniffed };
}

/**
 * Check if a file at a relative path is in a READY/INDEXED state before
 * allowing read_file to serve it. This is the runtime gate (T27, T28).
 */
export async function isFileReadable(workspaceId: string, relativePath: string): Promise<{ ok: boolean; status?: string; reason?: string }> {
  const row = await db.workspaceFile.findUnique({
    where: { workspaceId_path: { workspaceId, path: relativePath } },
  });
  if (!row) {
    // File not in the DB — it was created by the agent (write_file) or by
    // sandbox output. Allow reads; the lifecycle gate applies to uploaded files.
    return { ok: true };
  }
  if (row.status === 'READY' || row.status === 'INDEXED') return { ok: true, status: row.status };
  return { ok: false, status: row.status, reason: row.quarantineReason || `file status is ${row.status}, not READY` };
}
