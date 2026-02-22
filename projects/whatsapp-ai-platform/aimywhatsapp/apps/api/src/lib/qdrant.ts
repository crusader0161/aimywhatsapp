import { QdrantClient } from '@qdrant/js-client-rest'

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
})

export const VECTOR_SIZE = 1024 // Jina AI jina-embeddings-v3

export function collectionName(knowledgeBaseId: string): string {
  return `aimy_kb_${knowledgeBaseId}`
}

export async function ensureCollection(knowledgeBaseId: string): Promise<void> {
  const name = collectionName(knowledgeBaseId)
  try {
    await qdrant.getCollection(name)
  } catch {
    await qdrant.createCollection(name, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
    })
  }
}

export async function deleteCollection(knowledgeBaseId: string): Promise<void> {
  const name = collectionName(knowledgeBaseId)
  try {
    await qdrant.deleteCollection(name)
  } catch {
    // Collection might not exist
  }
}

export interface SearchResult {
  id: string
  score: number
  payload: {
    chunkId: string
    documentId: string
    content: string
    metadata?: Record<string, unknown>
  }
}

export async function searchSimilar(
  knowledgeBaseId: string,
  vector: number[],
  limit = 5,
  scoreThreshold = 0.75
): Promise<SearchResult[]> {
  const name = collectionName(knowledgeBaseId)
  const results = await qdrant.search(name, {
    vector,
    limit,
    score_threshold: scoreThreshold,
    with_payload: true,
  })

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload as SearchResult['payload'],
  }))
}
