import 'server-only'
import { mkdir, writeFile, readFile as fsReadFile, unlink } from 'node:fs/promises'
import { join, dirname, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from '@/lib/env'

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file'
}

/**
 * Where a storage key lives on disk, refusing anything that escapes STORAGE_DIR.
 *
 * Keys are minted by saveFile from a UUID and a sanitised name, so today none
 * can contain `..`. This check is here because that is a property of ONE
 * function, while the key travels through the engine's `documents.storage_key`
 * column and back — and read/delete paths that trust a database string are how
 * `../../etc/passwd` becomes a download. The guard costs a resolve() call.
 */
function absolutePath(storageKey: string): string {
  const root = resolve(env.STORAGE_DIR)
  const abs = resolve(join(root, storageKey))
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error('storage key escapes the storage directory')
  }
  return abs
}

export async function saveFile(
  workspaceId: string,
  filename: string,
  data: Buffer,
): Promise<{ storageKey: string; bytes: number }> {
  const storageKey = `${workspaceId}/${randomUUID()}-${safeName(filename)}`
  const abs = absolutePath(storageKey)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, data)
  return { storageKey, bytes: data.byteLength }
}

export async function readFile(storageKey: string): Promise<Buffer> {
  return fsReadFile(absolutePath(storageKey))
}

/**
 * Best-effort: a file that is already gone is a success, not a failure. The
 * record is the thing being deleted, and refusing to finish because the bytes
 * had vanished first would leave a document that can never be removed.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  try {
    await unlink(absolutePath(storageKey))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}
