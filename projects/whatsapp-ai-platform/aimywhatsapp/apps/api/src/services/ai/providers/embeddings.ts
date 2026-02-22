/**
 * Embeddings provider — Jina AI (jina-embeddings-v3, 1024 dimensions)
 * Free tier: 1M tokens/month at api.jina.ai
 */

const JINA_API_KEY = process.env.JINA_API_KEY!
const JINA_MODEL = process.env.JINA_EMBEDDING_MODEL || 'jina-embeddings-v3'
const VECTOR_SIZE = 1024

async function jinaEmbed(inputs: string[]): Promise<number[][]> {
  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JINA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: inputs.map(t => t.slice(0, 8000)),
      dimensions: VECTOR_SIZE,
      task: 'retrieval.passage',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Jina AI embedding error ${res.status}: ${err}`)
  }

  const data = await res.json() as { data: { embedding: number[] }[] }
  return data.data.map(d => d.embedding)
}

export async function getEmbedding(text: string): Promise<number[]> {
  const [embedding] = await jinaEmbed([text])
  return embedding
}

export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // Jina allows up to 2048 inputs per request; batch safely
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += 100) {
    const batch = await jinaEmbed(texts.slice(i, i + 100))
    results.push(...batch)
  }
  return results
}

export { VECTOR_SIZE }
