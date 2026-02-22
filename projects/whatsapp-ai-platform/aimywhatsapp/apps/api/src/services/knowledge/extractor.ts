/**
 * Document content extractor
 * Handles PDF, DOCX, TXT, CSV, and URL content extraction
 * Uses native Node 20 fetch (no got dependency needed)
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

export async function extractFromFile(filePath: string, fileType: string): Promise<string> {
  switch (fileType.toUpperCase()) {
    case 'PDF': {
      const { readFileSync } = await import('fs')
      const buffer = readFileSync(filePath)
      const result = await pdfParse(buffer)
      return result.text
    }
    case 'DOCX': {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value
    }
    case 'TXT':
    case 'CSV':
    case 'MANUAL': {
      const { readFileSync } = await import('fs')
      return readFileSync(filePath, 'utf-8')
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}

export async function extractFromUrl(url: string): Promise<string> {
  // Use native Node 20 fetch (no external dependency)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Aimywhatsapp/1.0 (content indexer)' },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)

  const html = await res.text()

  // Simple HTML to text extraction (no cheerio dependency in hot path)
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100000)

  return text
}

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
  }
  return chunks.filter(c => c.trim().length > 20)
}
