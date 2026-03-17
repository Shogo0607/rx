import https from 'node:https'
import http from 'node:http'
import tls from 'node:tls'

// Simple rate limiter (same pattern as literature-api.ts)
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

/**
 * Resolve proxy URL from environment variables.
 * Checks HTTPS_PROXY, https_proxy, HTTP_PROXY, http_proxy in order.
 */
function getProxyUrl(): string | null {
  return process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || null
}

export interface PatentSearchResult {
  patentNumber: string
  title: string
  abstract: string | null
  applicant: string | null
  inventors: string[]
  filingDate: string | null
  publicationDate: string | null
  jurisdiction: string | null
  classificationCodes: string[]
  url: string | null
  source: 'epo' | 'uspto' | 'google'
}

export interface PatentSearchResponse {
  patents: PatentSearchResult[]
  total: number
}

export interface PatentDetail extends PatentSearchResult {
  claims: string | null
  description: string | null
  familyId: string | null
}

export interface PatentFamily {
  familyId: string
  members: Array<{
    patentNumber: string
    jurisdiction: string
    publicationDate: string | null
  }>
}

export interface PatentSearchOptions {
  limit?: number
  offset?: number
  dateFrom?: string
  dateTo?: string
  jurisdiction?: string
}

// EPO OPS OAuth2 token management
interface OAuthToken {
  accessToken: string
  expiresAt: number
}

interface HttpRequestOptions {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}

interface HttpResponse {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
  text: () => Promise<string>
}

/**
 * Make an HTTPS request using node:https with proxy support and
 * rejectUnauthorized: false (for corporate proxy / MITM environments).
 * Replaces global fetch() which does not honour HTTP_PROXY and enforces
 * strict TLS, causing "TypeError: fetch failed" behind proxies.
 */
function httpsRequest(opts: HttpRequestOptions): Promise<HttpResponse> {
  const target = new URL(opts.url)
  const proxyUrl = getProxyUrl()

  // Ensure Content-Length is set for POST bodies to avoid chunked encoding,
  // which some servers (e.g. EPO OPS) reject with 415.
  const headers: Record<string, string> = { ...(opts.headers || {}) }
  if (opts.body && !headers['Content-Length']) {
    headers['Content-Length'] = String(Buffer.byteLength(opts.body, 'utf-8'))
  }

  const handleResponse = (res: import('node:http').IncomingMessage): Promise<HttpResponse> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString('utf-8')
        resolve({
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          json: () => Promise.resolve(JSON.parse(bodyStr)),
          text: () => Promise.resolve(bodyStr)
        })
      })
      res.on('error', reject)
    })
  }

  // Direct HTTPS request (no proxy)
  const makeDirectRequest = (): Promise<HttpResponse> => {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: target.hostname,
        port: target.port || 443,
        path: target.pathname + target.search,
        method: opts.method || 'GET',
        headers,
        rejectUnauthorized: false,
        timeout: 30000
      }, (res) => { handleResponse(res).then(resolve, reject) })

      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })

      if (opts.body) req.write(opts.body)
      req.end()
    })
  }

  // Request over an already-TLS socket (via proxy tunnel).
  // Use http.request — TLS is already handled by tls.connect, so
  // https.request would double-wrap and cause "wrong version number".
  const makeTunneledRequest = (tlsSocket: import('node:net').Socket): Promise<HttpResponse> => {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: target.hostname,
        port: target.port || 443,
        path: target.pathname + target.search,
        method: opts.method || 'GET',
        headers,
        timeout: 30000,
        createConnection: () => tlsSocket
      }, (res) => { handleResponse(res).then(resolve, reject) })

      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })

      if (opts.body) req.write(opts.body)
      req.end()
    })
  }

  if (proxyUrl) {
    const proxy = new URL(proxyUrl)
    const targetPort = parseInt(target.port || '443', 10)

    return new Promise((resolve, reject) => {
      const connectReq = http.request({
        host: proxy.hostname,
        port: parseInt(proxy.port || '8080', 10),
        method: 'CONNECT',
        path: `${target.hostname}:${targetPort}`,
        timeout: 15000
      })

      connectReq.on('connect', (_res, socket) => {
        const tlsSocket = tls.connect({
          socket,
          host: target.hostname,
          servername: target.hostname,
          rejectUnauthorized: false
        }, () => {
          makeTunneledRequest(tlsSocket as unknown as import('node:net').Socket).then(resolve, reject)
        })
        tlsSocket.on('error', reject)
      })

      connectReq.on('error', reject)
      connectReq.on('timeout', () => { connectReq.destroy(); reject(new Error('Proxy CONNECT timeout')) })
      connectReq.end()
    })
  }

  return makeDirectRequest()
}

export class PatentSearchApiService {
  private epoLimiter = new RateLimiter(3) // EPO OPS: ~3 req/s reasonable
  private usptoLimiter = new RateLimiter(5)
  private googleLimiter = new RateLimiter(2) // Be polite to Google
  private oauthToken: OAuthToken | null = null
  private consumerKey: string = ''
  private consumerSecret: string = ''

  setCredentials(consumerKey: string, consumerSecret: string): void {
    this.consumerKey = consumerKey
    this.consumerSecret = consumerSecret
    this.oauthToken = null // Reset token when credentials change
  }

  private async getEpoAccessToken(): Promise<string> {
    if (this.oauthToken && Date.now() < this.oauthToken.expiresAt - 60000) {
      return this.oauthToken.accessToken
    }

    if (!this.consumerKey || !this.consumerSecret) {
      throw new Error('EPO OPS credentials not configured. Please set epo_consumer_key and epo_consumer_secret in Settings.')
    }

    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64')

    const response = await httpsRequest({
      url: 'https://ops.epo.org/3.2/auth/accesstoken',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid EPO OPS credentials. Please check your consumer key and secret.')
      }
      throw new Error(`EPO OPS auth error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { access_token: string; expires_in: number }
    this.oauthToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000
    }

    return this.oauthToken.accessToken
  }

  async searchEpo(query: string, options: PatentSearchOptions = {}): Promise<PatentSearchResponse> {
    await this.epoLimiter.wait()

    const token = await this.getEpoAccessToken()
    const limit = Math.min(options.limit || 25, 100)
    const offset = options.offset || 1

    // Build CQL query for EPO OPS (GET only — POST returns 415)
    console.log(`[patent-search] EPO raw query: ${query}`)
    const keywords = this.extractEpoKeywords(query)
    console.log(`[patent-search] EPO extracted keywords: ${JSON.stringify(keywords)}`)

    if (keywords.length === 0) {
      console.warn('[patent-search] EPO: no usable English keywords — skipping')
      return { patents: [], total: 0 }
    }

    const rangeEnd = offset + limit - 1

    // Progressively broaden search until results are found:
    // 1) ta any with all keywords (title+abstract, any match)
    // 2) ta any with top 3 keywords (fewer = broader)
    // 3) txt any with top 3 keywords (full-text = broadest)
    const strategies = [
      this.buildEpoCql(keywords, options),
      ...(keywords.length > 3 ? [this.buildEpoCql(keywords.slice(0, 3), options)] : []),
      `txt any "${keywords.slice(0, 3).join(' ')}"`,
    ]

    for (const cql of strategies) {
      const result = await this.executeEpoSearch(cql, token, offset, rangeEnd)
      if (result) return result
    }

    console.log('[patent-search] EPO: all search strategies returned 0 results')
    return { patents: [], total: 0 }
  }

  private extractEpoKeywords(query: string): string[] {
    const stopWords = new Set(['and', 'or', 'not', 'the', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'has', 'have', 'been', 'using', 'based', 'method', 'system', 'device', 'apparatus', 'comprising', 'wherein', 'provided', 'includes', 'including'])
    return query
      .replace(/[^\x20-\x7E]/g, ' ')       // Strip non-ASCII (Japanese etc.)
      .replace(/\b(ta|ti|ab|cl|txt|pa|in|pn|pd|ic)\s*[=]/g, ' ') // Strip CQL field codes
      .replace(/\b(AND|OR|NOT)\b/gi, ' ')   // Strip CQL operators
      .replace(/["']/g, ' ')               // Strip quotes
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w.toLowerCase()))
      .slice(0, 8)
  }

  private buildEpoCql(keywords: string[], options: PatentSearchOptions): string {
    if (keywords.length === 0) return ''
    // "ta any" matches documents containing ANY of the keywords in title+abstract
    let cql = `ta any "${keywords.join(' ')}"`
    if (options.dateFrom) {
      cql += ` AND pd>=${options.dateFrom.replace(/-/g, '')}`
    }
    if (options.dateTo) {
      cql += ` AND pd<=${options.dateTo.replace(/-/g, '')}`
    }
    // Truncate if encoded query is too long for URL
    while (encodeURIComponent(cql).length > 1400) {
      const lastAnd = cql.lastIndexOf(' AND ')
      if (lastAnd <= 0) break
      cql = cql.slice(0, lastAnd)
    }
    return cql
  }

  private async executeEpoSearch(cql: string, token: string, offset: number, rangeEnd: number): Promise<PatentSearchResponse | null> {
    if (!cql) return null

    await this.epoLimiter.wait()

    const encodedQuery = encodeURIComponent(cql)
    const searchUrl = `https://ops.epo.org/3.2/rest-services/published-data/search?q=${encodedQuery}&Range=${offset}-${rangeEnd}`

    console.log(`[patent-search] EPO search CQL: ${cql}`)

    const response = await httpsRequest({
      url: searchUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })

    console.log(`[patent-search] EPO search response: ${response.status} ${response.statusText}`)

    if (response.status === 404) {
      console.log(`[patent-search] EPO 404 — no results for: ${cql}`)
      return null // Signal caller to try next strategy
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('EPO OPS rate limit exceeded. Please wait a moment.')
      }
      if (response.status === 403) {
        this.oauthToken = null
        throw new Error('EPO OPS access forbidden. Token may have expired, please retry.')
      }
      const errorBody = await response.text()
      console.warn(`[patent-search] EPO error ${response.status}: ${errorBody.slice(0, 300)}`)
      throw new Error(`EPO OPS API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as Record<string, unknown>
    const result = this.parseEpoSearchResponse(data)
    console.log(`[patent-search] EPO search found: ${result.patents.length} patents (total: ${result.total})`)
    return result
  }

  private parseEpoSearchResponse(data: Record<string, unknown>): PatentSearchResponse {
    const patents: PatentSearchResult[] = []
    let total = 0

    try {
      const searchResult = (data as Record<string, Record<string, unknown>>)?.['ops:world-patent-data']?.['ops:biblio-search']
      if (!searchResult) return { patents: [], total: 0 }

      total = parseInt(String((searchResult as Record<string, unknown>)?.['@total-result-count'] || '0'), 10)

      const results = (searchResult as Record<string, Record<string, unknown>>)?.['ops:search-result']?.['exchange-documents']
      if (!results) return { patents: [], total }

      const docs = Array.isArray(results) ? results : [results]

      for (const doc of docs) {
        try {
          const parsed = this.parseEpoDocument(doc as Record<string, unknown>)
          if (parsed) patents.push(parsed)
        } catch {
          // Skip unparseable documents
        }
      }
    } catch {
      // Return what we have
    }

    return { patents, total }
  }

  private parseEpoDocument(doc: Record<string, unknown>): PatentSearchResult | null {
    const exchangeDoc = (doc as Record<string, Record<string, unknown>>)?.['exchange-document'] || doc
    if (!exchangeDoc) return null

    const docId = exchangeDoc as Record<string, unknown>
    const country = String(docId?.['@country'] || '')
    const docNumber = String(docId?.['@doc-number'] || '')
    const kind = String(docId?.['@kind'] || '')
    const patentNumber = `${country}${docNumber}${kind}`

    // Extract bibliographic data
    const biblio = (exchangeDoc as Record<string, Record<string, unknown>>)?.['bibliographic-data']
    if (!biblio) return { patentNumber, title: 'Unknown', abstract: null, applicant: null, inventors: [], filingDate: null, publicationDate: null, jurisdiction: country, classificationCodes: [], url: null, source: 'epo' }

    // Title
    const titleData = biblio?.['invention-title']
    let title = 'Unknown'
    if (Array.isArray(titleData)) {
      const enTitle = (titleData as Array<Record<string, unknown>>).find((t) => t?.['@lang'] === 'en')
      title = String((enTitle || titleData[0])?.['$'] || (enTitle || titleData[0]) || 'Unknown')
    } else if (titleData) {
      title = String((titleData as Record<string, unknown>)?.['$'] || titleData || 'Unknown')
    }

    // Applicants
    const applicantData = (biblio as Record<string, Record<string, unknown>>)?.['parties']?.['applicants']?.['applicant']
    let applicant: string | null = null
    if (applicantData) {
      const appArr = Array.isArray(applicantData) ? applicantData : [applicantData]
      const names = appArr.map((a: Record<string, unknown>) => {
        const name = (a as Record<string, Record<string, unknown>>)?.['applicant-name']?.['name']
        return String((name as Record<string, unknown>)?.['$'] || name || '')
      }).filter(Boolean)
      applicant = names.join('; ') || null
    }

    // Inventors
    const inventorData = (biblio as Record<string, Record<string, unknown>>)?.['parties']?.['inventors']?.['inventor']
    const inventors: string[] = []
    if (inventorData) {
      const invArr = Array.isArray(inventorData) ? inventorData : [inventorData]
      for (const inv of invArr) {
        const name = ((inv as Record<string, Record<string, unknown>>)?.['inventor-name']?.['name'])
        const nameStr = String((name as Record<string, unknown>)?.['$'] || name || '')
        if (nameStr) inventors.push(nameStr)
      }
    }

    // Dates
    const pubRef = biblio?.['publication-reference']
    let publicationDate: string | null = null
    if (pubRef) {
      const docId2 = (pubRef as Record<string, Record<string, unknown>>)?.['document-id']
      const dateArr = Array.isArray(docId2) ? docId2 : [docId2]
      for (const d of dateArr) {
        const dateStr = String((d as Record<string, unknown>)?.['date']?.['$'] || (d as Record<string, unknown>)?.['date'] || '')
        if (dateStr && dateStr.length === 8) {
          publicationDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
          break
        }
      }
    }

    const appRef = biblio?.['application-reference']
    let filingDate: string | null = null
    if (appRef) {
      const docId3 = (appRef as Record<string, Record<string, unknown>>)?.['document-id']
      const dateArr = Array.isArray(docId3) ? docId3 : [docId3]
      for (const d of dateArr) {
        const dateStr = String((d as Record<string, unknown>)?.['date']?.['$'] || (d as Record<string, unknown>)?.['date'] || '')
        if (dateStr && dateStr.length === 8) {
          filingDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
          break
        }
      }
    }

    // Classification codes
    const classificationCodes: string[] = []
    const classData = biblio?.['patent-classifications']?.['patent-classification'] || biblio?.['classifications-ipcr']?.['classification-ipcr']
    if (classData) {
      const classArr = Array.isArray(classData) ? classData : [classData]
      for (const c of classArr) {
        const text = String((c as Record<string, unknown>)?.['text']?.['$'] || (c as Record<string, unknown>)?.['text'] || '')
        if (text) classificationCodes.push(text)
      }
    }

    return {
      patentNumber,
      title,
      abstract: null, // Abstract requires separate API call
      applicant,
      inventors,
      filingDate,
      publicationDate,
      jurisdiction: country,
      classificationCodes,
      url: `https://worldwide.espacenet.com/patent/search?q=pn%3D${patentNumber}`,
      source: 'epo'
    }
  }

  async getPatentDetails(patentNumber: string): Promise<PatentDetail | null> {
    await this.epoLimiter.wait()

    const token = await this.getEpoAccessToken()

    const response = await httpsRequest({
      url: `https://ops.epo.org/3.2/rest-services/published-data/publication/docdb/${patentNumber}/biblio,abstract`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`EPO OPS detail error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as Record<string, unknown>

    try {
      const worldData = (data as Record<string, Record<string, Record<string, unknown>>>)?.['ops:world-patent-data']?.['exchange-documents']?.['exchange-document']
      if (!worldData) return null

      const parsed = this.parseEpoDocument(worldData as Record<string, unknown>)
      if (!parsed) return null

      // Extract abstract
      const abstracts = (worldData as Record<string, Record<string, unknown>>)?.['abstract']
      let abstractText: string | null = null
      if (abstracts) {
        const absArr = Array.isArray(abstracts) ? abstracts : [abstracts]
        const enAbs = (absArr as Array<Record<string, unknown>>).find((a) => a?.['@lang'] === 'en')
        const absData = enAbs || absArr[0]
        const p = (absData as Record<string, unknown>)?.['p']
        abstractText = String((p as Record<string, unknown>)?.['$'] || p || '')
      }

      return {
        ...parsed,
        abstract: abstractText,
        claims: null,
        description: null,
        familyId: null
      }
    } catch {
      return null
    }
  }

  async getPatentFamily(patentNumber: string): Promise<PatentFamily | null> {
    await this.epoLimiter.wait()

    const token = await this.getEpoAccessToken()

    const response = await httpsRequest({
      url: `https://ops.epo.org/3.2/rest-services/family/publication/docdb/${patentNumber}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`EPO OPS family error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as Record<string, unknown>

    try {
      const familyData = (data as Record<string, Record<string, Record<string, unknown>>>)?.['ops:world-patent-data']?.['ops:patent-family']
      if (!familyData) return null

      const familyId = String((familyData as Record<string, unknown>)?.['@family-id'] || patentNumber)
      const members: PatentFamily['members'] = []

      const familyMembers = (familyData as Record<string, unknown>)?.['ops:family-member']
      if (familyMembers) {
        const memArr = Array.isArray(familyMembers) ? familyMembers : [familyMembers]
        for (const mem of memArr) {
          const pubRef = (mem as Record<string, Record<string, unknown>>)?.['publication-reference']?.['document-id']
          if (pubRef) {
            const idArr = Array.isArray(pubRef) ? pubRef : [pubRef]
            for (const id of idArr) {
              const idObj = id as Record<string, unknown>
              if (idObj?.['@document-id-type'] === 'docdb') {
                const country = String(idObj?.['country']?.['$'] || idObj?.['country'] || '')
                const docNum = String(idObj?.['doc-number']?.['$'] || idObj?.['doc-number'] || '')
                const kind = String(idObj?.['kind']?.['$'] || idObj?.['kind'] || '')
                const dateStr = String(idObj?.['date']?.['$'] || idObj?.['date'] || '')
                let pubDate: string | null = null
                if (dateStr && dateStr.length === 8) {
                  pubDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
                }
                members.push({
                  patentNumber: `${country}${docNum}${kind}`,
                  jurisdiction: country,
                  publicationDate: pubDate
                })
                break
              }
            }
          }
        }
      }

      return { familyId, members }
    } catch {
      return null
    }
  }

  async searchUspto(query: string, options: PatentSearchOptions = {}): Promise<PatentSearchResponse> {
    await this.usptoLimiter.wait()

    const size = Math.min(options.limit || 25, 100)
    const from = options.offset || 0

    // PatentsView API v2 (POST-based, Elasticsearch DSL)
    const requestBody = {
      q: query,
      f: ['patent_id', 'patent_title', 'patent_abstract', 'patent_date', 'assignees.assignee_organization', 'inventors.inventor_name_first', 'inventors.inventor_name_last'],
      s: [{ patent_date: 'desc' }],
      o: { size, from }
    }

    const response = await httpsRequest({
      url: 'https://search.patentsview.org/api/v1/patent/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RX-Research-App/0.1.0'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('USPTO PatentsView rate limit exceeded. Please wait a moment.')
      }
      throw new Error(`USPTO PatentsView API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      patents?: Array<{
        patent_id?: string
        patent_title?: string
        patent_abstract?: string
        patent_date?: string
        assignees?: Array<{ assignee_organization?: string }>
        inventors?: Array<{ inventor_name_first?: string; inventor_name_last?: string }>
      }>
      total_patent_count?: number
    }

    const patents: PatentSearchResult[] = (data.patents || []).map((p) => ({
      patentNumber: `US${p.patent_id || ''}`,
      title: p.patent_title || 'Untitled',
      abstract: p.patent_abstract || null,
      applicant: p.assignees?.[0]?.assignee_organization || null,
      inventors: (p.inventors || []).map((i) =>
        [i.inventor_name_first, i.inventor_name_last].filter(Boolean).join(' ')
      ),
      filingDate: null,
      publicationDate: p.patent_date || null,
      jurisdiction: 'US',
      classificationCodes: [],
      url: p.patent_id ? `https://patents.google.com/patent/US${p.patent_id}` : null,
      source: 'uspto' as const
    }))

    return { patents, total: data.total_patent_count || patents.length }
  }

  async searchAll(query: string, options: PatentSearchOptions = {}): Promise<PatentSearchResponse> {
    const results = await Promise.allSettled([
      this.searchEpo(query, options),
      this.searchUspto(query, options)
    ])

    const allPatents: PatentSearchResult[] = []
    let totalCount = 0

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPatents.push(...result.value.patents)
        totalCount += result.value.total
      } else {
        console.warn(`[patent-search] Source failed: ${result.reason}`)
      }
    }

    // Deduplicate by patent number
    const seen = new Set<string>()
    const deduplicated = allPatents.filter((patent) => {
      const key = patent.patentNumber.replace(/\s/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return { patents: deduplicated, total: totalCount }
  }

  // ── No-auth methods (Google Patents) ──

  hasEpoCredentials(): boolean {
    return !!(this.consumerKey && this.consumerSecret)
  }

  /**
   * Fetch individual patent data from Google Patents (no auth required).
   * Parses HTML meta tags for bibliographic data.
   *
   * Supports corporate proxy environments:
   * - Reads proxy from HTTPS_PROXY / HTTP_PROXY env vars
   * - Disables TLS certificate verification to work behind MITM proxies
   */
  async fetchPatentFromGoogle(patentNumber: string): Promise<PatentSearchResult | null> {
    await this.googleLimiter.wait()

    const cleanNumber = patentNumber.replace(/\s+/g, '')
    const url = `https://patents.google.com/patent/${cleanNumber}`

    try {
      const html = await this.fetchHtmlWithProxy(url)
      if (!html) return null

      const title = this.extractMetaContent(html, 'DC.title')
        || this.extractMetaContent(html, 'citation_title')
        || 'Unknown'
      const abstract = this.extractMetaContent(html, 'DC.description')
        || this.extractMetaContent(html, 'citation_abstract')
      const inventors = this.extractAllMetaContent(html, 'DC.contributor')
        .concat(this.extractAllMetaContent(html, 'citation_inventor'))
        .filter((v, i, a) => a.indexOf(v) === i) // dedupe
      const publicationDate = this.extractMetaContent(html, 'DC.date')
        || this.extractMetaContent(html, 'citation_date')
      const applicant = this.extractMetaContent(html, 'citation_assignee')

      const countryMatch = cleanNumber.match(/^([A-Z]{2})/)
      const jurisdiction = countryMatch ? countryMatch[1] : null

      // Skip if we couldn't extract basic data
      if (title === 'Unknown' && !abstract) return null

      return {
        patentNumber: cleanNumber,
        title,
        abstract: abstract || null,
        applicant: applicant || null,
        inventors,
        filingDate: null,
        publicationDate: publicationDate || null,
        jurisdiction,
        classificationCodes: [],
        url,
        source: 'google'
      }
    } catch {
      return null
    }
  }

  /**
   * Fetch HTML from a URL with proxy support and TLS verification disabled.
   * Uses node:https/http directly — no external proxy agent dependency.
   * For HTTPS through a proxy, opens a CONNECT tunnel manually.
   */
  private async fetchHtmlWithProxy(url: string, redirectCount = 0): Promise<string | null> {
    if (redirectCount > 5) return null

    const proxyUrl = getProxyUrl()
    const target = new URL(url)
    const isHttps = target.protocol === 'https:'

    if (proxyUrl && isHttps) {
      // HTTPS through proxy: open CONNECT tunnel, then TLS over it
      return this.fetchViaTunnel(url, proxyUrl, redirectCount)
    }

    // Direct request (no proxy) or HTTP through proxy
    const requestOptions: https.RequestOptions & http.RequestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RX-Research-App/0.1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      rejectUnauthorized: false,
      timeout: 30000
    }

    const transport = isHttps ? https : http

    return new Promise<string | null>((resolve) => {
      const req = transport.get(url, requestOptions, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href
          this.fetchHtmlWithProxy(redirectUrl, redirectCount + 1).then(resolve).catch(() => resolve(null))
          return
        }
        if (res.statusCode && res.statusCode >= 400) { resolve(null); return }

        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        res.on('error', () => resolve(null))
      })
      req.on('error', (err) => {
        console.warn(`[patent-search] Fetch error for ${url}: ${err.message}`)
        resolve(null)
      })
      req.on('timeout', () => { req.destroy(); resolve(null) })
    })
  }

  /**
   * Fetch HTTPS URL via HTTP CONNECT tunnel through a proxy.
   * No external dependencies — uses node:http for the CONNECT handshake
   * and node:tls to upgrade the tunneled socket.
   */
  private fetchViaTunnel(url: string, proxyUrl: string, redirectCount: number): Promise<string | null> {
    const target = new URL(url)
    const proxy = new URL(proxyUrl)
    const targetPort = parseInt(target.port || '443', 10)

    console.log(`[patent-search] Using proxy tunnel: ${proxy.host} → ${target.host}`)

    return new Promise<string | null>((resolve) => {
      const connectReq = http.request({
        host: proxy.hostname,
        port: parseInt(proxy.port || '8080', 10),
        method: 'CONNECT',
        path: `${target.hostname}:${targetPort}`,
        timeout: 15000
      })

      connectReq.on('connect', (_res, socket) => {
        // Upgrade to TLS over the tunneled socket, skip cert verification
        const tlsSocket = tls.connect({
          socket,
          host: target.hostname,
          servername: target.hostname,
          rejectUnauthorized: false
        }, () => {
          // TLS handshake done — send the actual HTTP request over TLS
          const reqPath = target.pathname + target.search
          const reqHeaders = [
            `GET ${reqPath} HTTP/1.1`,
            `Host: ${target.hostname}`,
            'User-Agent: Mozilla/5.0 (compatible; RX-Research-App/0.1.0)',
            'Accept: text/html,application/xhtml+xml',
            'Connection: close',
            '',
            ''
          ].join('\r\n')

          tlsSocket.write(reqHeaders)

          const chunks: Buffer[] = []
          tlsSocket.on('data', (chunk: Buffer) => chunks.push(chunk))
          tlsSocket.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8')
            // Parse HTTP response: split headers from body
            const headerEnd = raw.indexOf('\r\n\r\n')
            if (headerEnd === -1) { resolve(null); return }

            const headerBlock = raw.slice(0, headerEnd)
            const body = raw.slice(headerEnd + 4)
            const statusMatch = headerBlock.match(/^HTTP\/\d\.\d (\d{3})/)
            const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0

            // Handle redirects
            if (statusCode >= 300 && statusCode < 400) {
              const locMatch = headerBlock.match(/[Ll]ocation:\s*(.+?)(?:\r?\n|$)/)
              if (locMatch?.[1]) {
                const redirectUrl = new URL(locMatch[1].trim(), url).href
                this.fetchHtmlWithProxy(redirectUrl, redirectCount + 1).then(resolve).catch(() => resolve(null))
                return
              }
            }

            if (statusCode >= 400) { resolve(null); return }
            resolve(body)
          })
          tlsSocket.on('error', () => resolve(null))
        })

        tlsSocket.on('error', (err) => {
          console.warn(`[patent-search] TLS tunnel error: ${err.message}`)
          resolve(null)
        })
      })

      connectReq.on('error', (err) => {
        console.warn(`[patent-search] Proxy CONNECT error: ${err.message}`)
        resolve(null)
      })
      connectReq.on('timeout', () => { connectReq.destroy(); resolve(null) })
      connectReq.end()
    })
  }

  /**
   * Fetch multiple patents from Google Patents by patent numbers.
   * No authentication required.
   */
  async fetchPatentsFromGoogle(patentNumbers: string[]): Promise<PatentSearchResponse> {
    const results: PatentSearchResult[] = []

    for (const num of patentNumbers) {
      const patent = await this.fetchPatentFromGoogle(num)
      if (patent) {
        results.push(patent)
      }
    }

    return { patents: results, total: results.length }
  }

  private extractMetaContent(html: string, name: string): string | null {
    // Handle both <meta name="X" content="Y"> and <meta content="Y" name="X">
    const patterns = [
      new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`, 'i')
    ]
    for (const regex of patterns) {
      const match = html.match(regex)
      if (match?.[1]) return match[1]
    }
    return null
  }

  private extractAllMetaContent(html: string, name: string): string[] {
    const results: string[] = []
    const patterns = [
      new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, 'gi'),
      new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`, 'gi')
    ]
    for (const regex of patterns) {
      let match
      while ((match = regex.exec(html)) !== null) {
        if (match[1]) results.push(match[1])
      }
    }
    return results
  }
}

// Singleton instance
export const patentSearchApiService = new PatentSearchApiService()
