import { createWriteStream, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { nanoid } from 'nanoid'
import { pipeline } from 'stream/promises'
import { MultipartFile } from '@fastify/multipart'

const STORAGE_PATH = process.env.STORAGE_PATH || './data/uploads'

// Ensure upload directories exist
const DIRS = ['documents', 'media', 'avatars']
DIRS.forEach((dir) => {
  mkdirSync(join(STORAGE_PATH, dir), { recursive: true })
})

export interface StoredFile {
  path: string      // relative path for DB storage
  fullPath: string  // absolute path for file operations
  url: string       // public URL
  filename: string
  mimetype: string
  size: number
}

export async function saveUploadedFile(
  file: MultipartFile,
  subdir: 'documents' | 'media' | 'avatars' = 'documents'
): Promise<StoredFile> {
  const ext = extname(file.filename)
  const uniqueName = `${nanoid()}_${Date.now()}${ext}`
  const relativePath = `${subdir}/${uniqueName}`
  const fullPath = join(STORAGE_PATH, relativePath)

  await pipeline(file.file, createWriteStream(fullPath))

  // Get file size
  const { statSync } = await import('fs')
  const stats = statSync(fullPath)

  return {
    path: relativePath,
    fullPath,
    url: `/uploads/${relativePath}`,
    filename: file.filename,
    mimetype: file.mimetype,
    size: stats.size,
  }
}

export function getFullPath(relativePath: string): string {
  return join(STORAGE_PATH, relativePath)
}

export function getFileUrl(relativePath: string): string {
  return `/uploads/${relativePath}`
}
