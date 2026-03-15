interface Paper {
  id: string
  title: string
  authors: string[]
  abstract: string | null
  doi: string | null
  url: string | null
  year: number | null
  citationCount: number | null
  source: string
}

interface SearchResult {
  papers: Paper[]
  total: number
}

// Simple rate limiter
class RateLimiter {
  private lastCall: number = 0
  private minInterval: number

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond
  }

  async wait(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastCall
    if (elapsed < this.minInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minInterval - elapsed))
    }
    this.lastCall = Date.now()
  }
}

export class LiteratureApiService {
  private semanticScholarLimiter = new RateLimiter(3) // 3 req/s free tier
  private crossRefLimiter = new RateLimiter(5)
  private arxivLimiter = new RateLimiter(1) // arxiv is strict

  async searchSemanticScholar(query: string, limit: number = 20): Promise<SearchResult> {
    await this.semanticScholarLimiter.wait()

    const params = new URLSearchParams({
      query,
      limit: String(Math.min(limit, 100)),
      fields: 'title,authors,abstract,doi,url,year,citationCount,externalIds'
    })

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`
    )

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Semantic Scholar rate limit exceeded. Please wait a moment.')
      }
      throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
      total: number
      data?: Array<{
        paperId: string
        title: string
        authors?: Array<{ name: string }>
        abstract?: string
        doi?: string
        url?: string
        year?: number
        citationCount?: number
      }>
    }

    const papers: Paper[] = (data.data || []).map((item) => ({
      id: item.paperId,
      title: item.title,
      authors: (item.authors || []).map((a) => a.name),
      abstract: item.abstract || null,
      doi: item.doi || null,
      url: item.url || null,
      year: item.year || null,
      citationCount: item.citationCount ?? null,
      source: 'semantic_scholar'
    }))

    return { papers, total: data.total || papers.length }
  }

  async searchCrossRef(query: string, limit: number = 20): Promise<SearchResult> {
    await this.crossRefLimiter.wait()

    const params = new URLSearchParams({
      query,
      rows: String(Math.min(limit, 100)),
      select: 'DOI,title,author,abstract,URL,published-print,is-referenced-by-count'
    })

    const response = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: {
        'User-Agent': 'RX-Research-App/0.1.0 (mailto:research@example.com)'
      }
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('CrossRef rate limit exceeded. Please wait a moment.')
      }
      throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
      message: {
        'total-results': number
        items: Array<{
          DOI?: string
          title?: string[]
          author?: Array<{ given?: string; family?: string }>
          abstract?: string
          URL?: string
          'published-print'?: { 'date-parts'?: number[][] }
          'is-referenced-by-count'?: number
        }>
      }
    }

    const papers: Paper[] = data.message.items.map((item) => ({
      id: item.DOI || crypto.randomUUID(),
      title: item.title?.[0] || 'Untitled',
      authors: (item.author || []).map((a) =>
        [a.given, a.family].filter(Boolean).join(' ')
      ),
      abstract: item.abstract ? stripHtml(item.abstract) : null,
      doi: item.DOI || null,
      url: item.URL || null,
      year: item['published-print']?.['date-parts']?.[0]?.[0] || null,
      citationCount: item['is-referenced-by-count'] ?? null,
      source: 'crossref'
    }))

    return { papers, total: data.message['total-results'] || papers.length }
  }

  async searchArxiv(query: string, limit: number = 20): Promise<SearchResult> {
    await this.arxivLimiter.wait()

    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: '0',
      max_results: String(Math.min(limit, 100)),
      sortBy: 'relevance',
      sortOrder: 'descending'
    })

    const response = await fetch(`https://export.arxiv.org/api/query?${params}`)

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`)
    }

    const xml = await response.text()
    const papers = parseArxivXml(xml)

    return { papers, total: papers.length }
  }

  async searchAll(query: string, limit: number = 10): Promise<SearchResult> {
    const results = await Promise.allSettled([
      this.searchSemanticScholar(query, limit),
      this.searchCrossRef(query, limit),
      this.searchArxiv(query, limit)
    ])

    const allPapers: Paper[] = []
    let totalCount = 0

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPapers.push(...result.value.papers)
        totalCount += result.value.total
      } else {
        console.warn(`[literature-api] Search source failed: ${result.reason}`)
      }
    }

    // Deduplicate by DOI
    const seen = new Set<string>()
    const deduplicated = allPapers.filter((paper) => {
      if (paper.doi && seen.has(paper.doi)) {
        return false
      }
      if (paper.doi) {
        seen.add(paper.doi)
      }
      return true
    })

    return { papers: deduplicated, total: totalCount }
  }

  async getCitations(paperId: string): Promise<Paper[]> {
    await this.semanticScholarLimiter.wait()

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?fields=title,authors,abstract,doi,url,year,citationCount&limit=100`
    )

    if (!response.ok) {
      throw new Error(`Failed to get citations: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
      data: Array<{
        citingPaper: {
          paperId: string
          title: string
          authors?: Array<{ name: string }>
          abstract?: string
          doi?: string
          url?: string
          year?: number
          citationCount?: number
        }
      }>
    }

    return data.data.map((item) => ({
      id: item.citingPaper.paperId,
      title: item.citingPaper.title,
      authors: (item.citingPaper.authors || []).map((a) => a.name),
      abstract: item.citingPaper.abstract || null,
      doi: item.citingPaper.doi || null,
      url: item.citingPaper.url || null,
      year: item.citingPaper.year || null,
      citationCount: item.citingPaper.citationCount ?? null,
      source: 'semantic_scholar'
    }))
  }

  async getReferences(paperId: string): Promise<Paper[]> {
    await this.semanticScholarLimiter.wait()

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/${paperId}/references?fields=title,authors,abstract,doi,url,year,citationCount&limit=100`
    )

    if (!response.ok) {
      throw new Error(`Failed to get references: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
      data: Array<{
        citedPaper: {
          paperId: string
          title: string
          authors?: Array<{ name: string }>
          abstract?: string
          doi?: string
          url?: string
          year?: number
          citationCount?: number
        }
      }>
    }

    return data.data
      .filter((item) => item.citedPaper.title) // Filter out incomplete entries
      .map((item) => ({
        id: item.citedPaper.paperId,
        title: item.citedPaper.title,
        authors: (item.citedPaper.authors || []).map((a) => a.name),
        abstract: item.citedPaper.abstract || null,
        doi: item.citedPaper.doi || null,
        url: item.citedPaper.url || null,
        year: item.citedPaper.year || null,
        citationCount: item.citedPaper.citationCount ?? null,
        source: 'semantic_scholar'
      }))
  }
}

// --- Helpers ---

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

function parseArxivXml(xml: string): Paper[] {
  const papers: Paper[] = []

  // Extract entries from the Atom XML feed
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let entryMatch: RegExpExecArray | null

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entry = entryMatch[1]

    const id = extractXmlTag(entry, 'id')
    const title = extractXmlTag(entry, 'title')?.replace(/\s+/g, ' ').trim()
    const summary = extractXmlTag(entry, 'summary')?.replace(/\s+/g, ' ').trim()
    const published = extractXmlTag(entry, 'published')

    // Extract authors
    const authors: string[] = []
    const authorRegex = /<author>\s*<name>([^<]+)<\/name>/g
    let authorMatch: RegExpExecArray | null
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1].trim())
    }

    // Extract DOI from arxiv links if available
    const doiMatch = entry.match(/doi\.org\/([^"<\s]+)/)
    const doi = doiMatch ? doiMatch[1] : null

    // Extract arxiv ID for URL
    const arxivId = id?.replace('http://arxiv.org/abs/', '') || null
    const year = published ? parseInt(published.substring(0, 4), 10) : null

    if (title) {
      papers.push({
        id: arxivId || crypto.randomUUID(),
        title,
        authors,
        abstract: summary || null,
        doi,
        url: id || null,
        year: year || null,
        citationCount: null,
        source: 'arxiv'
      })
    }
  }

  return papers
}

function extractXmlTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

// Singleton instance
export const literatureApiService = new LiteratureApiService()
