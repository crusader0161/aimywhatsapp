import OpenAI from 'openai'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { tmpdir } from 'os'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(buffer: Buffer): Promise<string> {
  // Write buffer to temp file (Whisper needs a file)
  const tempPath = join(tmpdir(), `audio_${nanoid()}.ogg`)
  writeFileSync(tempPath, buffer)

  try {
    const response = await openai.audio.transcriptions.create({
      file: new File([buffer], 'audio.ogg', { type: 'audio/ogg' }),
      model: 'whisper-1',
    })
    return response.text
  } finally {
    try { unlinkSync(tempPath) } catch {}
  }
}
