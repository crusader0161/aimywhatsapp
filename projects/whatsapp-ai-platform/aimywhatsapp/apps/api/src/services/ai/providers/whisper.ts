/**
 * Audio transcription stub
 * Whisper requires OpenAI API key which is not configured.
 * Returns a placeholder — upgrade by adding OPENAI_API_KEY to .env
 */
export async function transcribeAudio(_buffer: Buffer): Promise<string> {
  // TODO: integrate OpenAI Whisper or Groq Whisper when key is available
  return '[Audio message received — voice transcription not enabled]'
}
