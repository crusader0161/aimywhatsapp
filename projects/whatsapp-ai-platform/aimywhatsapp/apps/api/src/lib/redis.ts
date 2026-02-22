import { Redis } from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('✅ Redis connected')
})

// Helper: cache with TTL
export async function cacheGet<T>(key: string): Promise<T | null> {
  const val = await redis.get(key)
  if (!val) return null
  try {
    return JSON.parse(val) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key)
}

export default redis
