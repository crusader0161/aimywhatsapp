/**
 * Document content extractor
 * Handles PDF, DOCX, TXT, CSV, and URL content extraction
 */

export async function extractFromFile(filePath: string, fileType: string): Promise<string> {
  switch (fileType.toUpperCase()) {
    case 'PDF': {
      const { readFileSync } = await import('fs')
      const pdfParse = (await import('pdf-parse')).default
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
  const got = (await import('got')).default
  const { load } = await import('cheerio')

  const html = await got(url, {
    timeout: { request: 15000 },
    headers: { 'User-Agent': 'Aimywhatsapp/1.0 (content indexer)' },
  }).text()

  const $ = load(html)

  // Remove noise elements
  $('nav, footer, header, script, style, iframe, .ad, .advertisement, .sidebar, .menu, .cookie-notice').remove()

  // Try to get main content
  const mainContent =
    $('main').text() ||
    $('article').text() ||
    $('#content').text() ||
    $('[role="main"]').text() ||
    $('body').text()

  return mainContent
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 100000) // Cap at 100k chars
}

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || text.split(/\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim())
      // Overlap: keep last portion
      const words = current.split(' ')
      current = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence
    } else {
      current += ' ' + sentence
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.length > 20)
}
