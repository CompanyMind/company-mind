import 'server-only'
import { mkdir, writeFile, readFile as fsReadFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from '@/lib/env'

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file'
}

export async function saveFile(
  workspaceId: string,
  filename: string,
  data: Buffer,
): Promise<{ storageKey: string; bytes: number }> {
  const storageKey = `${workspaceId}/${randomUUID()}-${safeName(filename)}`
  const abs = join(env.STORAGE_DIR, storageKey)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, data)
  return { storageKey, bytes: data.byteLength }
}

export async function readFile(storageKey: string): Promise<Buffer> {
  return fsReadFile(join(env.STORAGE_DIR, storageKey))
}
