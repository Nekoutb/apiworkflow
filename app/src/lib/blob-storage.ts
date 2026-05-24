/**
 * Thin wrapper over @vercel/blob.
 *
 * - In production with BLOB_READ_WRITE_TOKEN set: real Blob upload + delete.
 * - Otherwise (local dev, missing token): returns a placeholder URI prefixed
 *   with `local-stub://` so the rest of the app keeps working.  The Document
 *   row is still created — only the file bytes don't survive.  A banner on
 *   /investor/conventions/[id]/edit warns the user when this happens.
 */

import { put, del } from '@vercel/blob';

export type StoredBlob = {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
  stub: boolean;
};

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function storePdf(args: {
  pathname: string;          // e.g. "conventions/<id>/<kind>-<ts>.pdf"
  file: File;
  contentType?: string;
}): Promise<StoredBlob> {
  const contentType = args.contentType ?? args.file.type ?? 'application/pdf';

  if (!isBlobConfigured()) {
    return {
      url: `local-stub://${args.pathname}`,
      pathname: args.pathname,
      contentType,
      size: args.file.size,
      stub: true,
    };
  }

  const blob = await put(args.pathname, args.file, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: blob.contentType ?? contentType,
    size: args.file.size,
    stub: false,
  };
}

export async function removeBlob(url: string): Promise<void> {
  if (url.startsWith('local-stub://')) return;
  if (!isBlobConfigured()) return;
  try {
    await del(url);
  } catch (err) {
    // Don't block the user flow on a Blob delete failure — log only.
    console.warn('[blob:del]', (err as Error).message);
  }
}
