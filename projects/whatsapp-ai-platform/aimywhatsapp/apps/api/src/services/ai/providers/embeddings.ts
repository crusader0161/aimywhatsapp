import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: process.env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-3-small',
    input: text.slice(0, 8000), // Token limit
  })
  return response.data[0].embedding
}

export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: process.env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-3-small',
    input: texts.map((t) => t.slice(0, 8000)),
  })
  return response.data.map((d) => d.embedding)
}
