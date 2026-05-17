/**
 * Storage abstraction.
 *
 * Two backends:
 * - LocalDiskStorage (default in dev, when STORAGE_DRIVER=disk or unset)
 * - VercelBlobStorage (when STORAGE_DRIVER=vercel-blob)
 *
 * Phase 1 W3 uses local disk; production swap to Vercel Blob (or S3)
 * is a one-line env change.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StoredFile {
  /** Opaque URI ('disk://path' or 'https://...') */
  uri: string;
  sha256: string;
  sizeBytes: number;
  contentType: string;
}

export interface StorageBackend {
  put(buffer: Buffer, opts: { name: string; contentType: string; folder?: string }): Promise<StoredFile>;
  get(uri: string): Promise<Buffer>;
  delete(uri: string): Promise<void>;
}

// ------------------ Local disk backend ------------------

const ROOT = path.resolve(process.cwd(), '.uploads');

class LocalDiskStorage implements StorageBackend {
  async put(buffer: Buffer, opts: { name: string; contentType: string; folder?: string }): Promise<StoredFile> {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = path.extname(opts.name) || '';
    const stem = sha256.slice(0, 16); // dedupe by hash prefix
    const folder = opts.folder ? path.join(ROOT, opts.folder) : ROOT;
    await fs.mkdir(folder, { recursive: true });
    const filePath = path.join(folder, `${stem}${ext}`);
    await fs.writeFile(filePath, buffer);
    return {
      uri: `disk://${path.relative(ROOT, filePath).replace(/\\/g, '/')}`,
      sha256,
      sizeBytes: buffer.length,
      contentType: opts.contentType,
    };
  }
  async get(uri: string): Promise<Buffer> {
    if (!uri.startsWith('disk://')) throw new Error('Not a disk URI');
    const rel = uri.slice('disk://'.length);
    return fs.readFile(path.join(ROOT, rel));
  }
  async delete(uri: string): Promise<void> {
    if (!uri.startsWith('disk://')) return;
    const rel = uri.slice('disk://'.length);
    await fs.unlink(path.join(ROOT, rel)).catch(() => {});
  }
}

// ------------------ Vercel Blob backend (Phase 2) ------------------
// Implementation deferred until @vercel/blob is added.
// Stubbed to throw a clear error so we notice if env says vercel-blob
// before the implementation lands.

class VercelBlobStorage implements StorageBackend {
  async put(): Promise<StoredFile> {
    throw new Error('VercelBlobStorage not implemented yet. Set STORAGE_DRIVER=disk for now.');
  }
  async get(): Promise<Buffer> {
    throw new Error('VercelBlobStorage not implemented yet.');
  }
  async delete(): Promise<void> {
    throw new Error('VercelBlobStorage not implemented yet.');
  }
}

// ------------------ Factory ------------------

let cached: StorageBackend | null = null;

export function getStorage(): StorageBackend {
  if (cached) return cached;
  const driver = (process.env.STORAGE_DRIVER || 'disk').toLowerCase();
  cached = driver === 'vercel-blob' ? new VercelBlobStorage() : new LocalDiskStorage();
  return cached;
}
