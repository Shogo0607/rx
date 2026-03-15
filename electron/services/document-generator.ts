import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  TableOfContents,
  ImageRun
} from 'docx'
import type { TDocumentDefinitions, Content, ContentText } from 'pdfmake/interfaces'

// pdfmake needs to be required differently in Node
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake')

interface Section {
  heading: string
  level?: number // 1 = H1, 2 = H2, etc.
  body?: string
  subsections?: Section[]
}

interface DocumentImage {
  label: string
  data: Buffer // PNG data
  width: number
  height: number
}

interface DocumentContent {
  title: string
  authors?: string[]
  date?: string
  abstract?: string
  keywords?: string[]
  sections: Section[]
  references?: string[]
  images?: DocumentImage[]
}

type TemplateType =
  | 'paper-imrad'
  | 'patent-jp'
  | 'patent-us'
  | 'report-progress'
  | 'report-final'

const FONT_DESCRIPTORS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
}

export class DocumentGenerator {
  async generateDocx(content: DocumentContent, template?: TemplateType): Promise<Buffer> {
    const enriched = applyTemplate(content, template)
    const doc = buildDocxDocument(enriched, template)
    const buffer = await Packer.toBuffer(doc)
    return Buffer.from(buffer)
  }

  async generatePdf(content: DocumentContent, template?: TemplateType): Promise<Buffer> {
    const enriched = applyTemplate(content, template)
    const docDefinition = buildPdfDefinition(enriched, template)

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const printer = new PdfPrinter(FONT_DESCRIPTORS)
        const pdfDoc = printer.createPdfKitDocument(docDefinition)

        const chunks: Uint8Array[] = []
        pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
        pdfDoc.on('error', (err: Error) => reject(err))
        pdfDoc.end()
      } catch (err) {
        reject(err)
      }
    })
  }
}

// --- Template application ---

function applyTemplate(content: DocumentContent, template?: TemplateType): DocumentContent {
  if (!template) return content

  switch (template) {
    case 'paper-imrad': {
      // Ensure IMRAD structure exists
      const requiredSections = ['Introduction', 'Methods', 'Results', 'Discussion']
      const existingHeadings = new Set(content.sections.map((s) => s.heading))
      const sections = [...content.sections]

      for (const heading of requiredSections) {
        if (!existingHeadings.has(heading)) {
          sections.push({ heading, body: '' })
        }
      }

      // Reorder to IMRAD
      const ordered: Section[] = []
      for (const heading of requiredSections) {
        const section = sections.find((s) => s.heading === heading)
        if (section) ordered.push(section)
      }
      // Add any extra sections after
      for (const section of sections) {
        if (!requiredSections.includes(section.heading)) {
          ordered.push(section)
        }
      }

      return { ...content, sections: ordered }
    }

    case 'patent-jp':
    case 'patent-us':
      // Patent sections are already structured by the client (with locale-aware headings)
      return content

    case 'report-progress':
    case 'report-final': {
      const reportSections =
        template === 'report-progress'
          ? ['Executive Summary', 'Progress Overview', 'Completed Tasks', 'In Progress', 'Challenges', 'Next Steps']
          : ['Executive Summary', 'Introduction', 'Methodology', 'Findings', 'Analysis', 'Conclusions', 'Recommendations', 'Appendices']
      return ensureSections(content, reportSections)
    }

    default:
      return content
  }
}

function ensureSections(content: DocumentContent, requiredSections: string[]): DocumentContent {
  const existingHeadings = new Set(content.sections.map((s) => s.heading))
  const sections = [...content.sections]

  for (const heading of requiredSections) {
    if (!existingHeadings.has(heading)) {
      sections.push({ heading, body: '' })
    }
  }

  // Reorder
  const ordered: Section[] = []
  for (const heading of requiredSections) {
    const section = sections.find((s) => s.heading === heading)
    if (section) ordered.push(section)
  }
  for (const section of sections) {
    if (!requiredSections.includes(section.heading)) {
      ordered.push(section)
    }
  }

  return { ...content, sections: ordered }
}

// --- DOCX builder ---

function buildDocxDocument(content: DocumentContent, _template?: TemplateType): Document {
  const children: Paragraph[] = []

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: content.title, bold: true, size: 32 })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  )

  // Authors
  if (content.authors && content.authors.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: content.authors.join(', '), italics: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      })
    )
  }

  // Date
  if (content.date) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: content.date, size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      })
    )
  }

  // Abstract
  if (content.abstract) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Abstract', bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 }
      })
    )
    children.push(
      new Paragraph({
        children: [new TextRun({ text: content.abstract, size: 22 })],
        spacing: { after: 200 }
      })
    )
  }

  // Keywords
  if (content.keywords && content.keywords.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Keywords: ', bold: true, size: 22 }),
          new TextRun({ text: content.keywords.join(', '), italics: true, size: 22 })
        ],
        spacing: { after: 300 }
      })
    )
  }

  // Sections
  for (const section of content.sections) {
    addDocxSection(children, section, 1)
  }

  // References
  if (content.references && content.references.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'References', bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 100 }
      })
    )
    for (let i = 0; i < content.references.length; i++) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `[${i + 1}] ${content.references[i]}`, size: 20 })],
          spacing: { after: 60 }
        })
      )
    }
  }

  // Images (patent figures)
  if (content.images && content.images.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '', size: 22 })],
        spacing: { before: 400 }
      })
    )

    for (let i = 0; i < content.images.length; i++) {
      const img = content.images[i]
      // Figure caption
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `【図${i + 1}】${img.label}`, bold: true, size: 22 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 100 }
        })
      )
      // Image
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: img.data,
              transformation: {
                width: Math.min(img.width, 500),
                height: Math.min(img.height, 400)
              },
              type: 'png'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      )
    }
  }

  return new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: content.title, size: 18, italics: true })],
                alignment: AlignmentType.RIGHT
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                  new TextRun({ text: ' / ', size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        properties: {
          page: {
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL }
          }
        },
        children
      }
    ]
  })
}

function addDocxSection(children: Paragraph[], section: Section, level: number): void {
  const headingLevel =
    level === 1
      ? HeadingLevel.HEADING_1
      : level === 2
        ? HeadingLevel.HEADING_2
        : HeadingLevel.HEADING_3

  children.push(
    new Paragraph({
      children: [new TextRun({ text: section.heading, bold: true, size: 28 - level * 2 })],
      heading: headingLevel,
      spacing: { before: 300, after: 100 }
    })
  )

  if (section.body) {
    // Split body into paragraphs
    const paragraphs = section.body.split('\n\n')
    for (const para of paragraphs) {
      if (para.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: para.trim(), size: 22 })],
            spacing: { after: 120 }
          })
        )
      }
    }
  }

  if (section.subsections) {
    for (const sub of section.subsections) {
      addDocxSection(children, sub, level + 1)
    }
  }
}

// --- PDF builder ---

function buildPdfDefinition(content: DocumentContent, _template?: TemplateType): TDocumentDefinitions {
  const body: Content[] = []

  // Title
  body.push({
    text: content.title,
    fontSize: 20,
    bold: true,
    alignment: 'center',
    margin: [0, 0, 0, 10]
  } as ContentText)

  // Authors
  if (content.authors && content.authors.length > 0) {
    body.push({
      text: content.authors.join(', '),
      fontSize: 12,
      italics: true,
      alignment: 'center',
      margin: [0, 0, 0, 5]
    } as ContentText)
  }

  // Date
  if (content.date) {
    body.push({
      text: content.date,
      fontSize: 11,
      alignment: 'center',
      margin: [0, 0, 0, 20]
    } as ContentText)
  }

  // Abstract
  if (content.abstract) {
    body.push({
      text: 'Abstract',
      fontSize: 14,
      bold: true,
      margin: [0, 15, 0, 5]
    } as ContentText)
    body.push({
      text: content.abstract,
      fontSize: 11,
      italics: true,
      margin: [20, 0, 20, 10]
    } as ContentText)
  }

  // Keywords
  if (content.keywords && content.keywords.length > 0) {
    body.push({
      text: [
        { text: 'Keywords: ', bold: true },
        { text: content.keywords.join(', '), italics: true }
      ],
      fontSize: 10,
      margin: [20, 0, 20, 20]
    })
  }

  // Sections
  for (const section of content.sections) {
    addPdfSection(body, section, 1)
  }

  // References
  if (content.references && content.references.length > 0) {
    body.push({
      text: 'References',
      fontSize: 14,
      bold: true,
      margin: [0, 20, 0, 5]
    } as ContentText)
    for (let i = 0; i < content.references.length; i++) {
      body.push({
        text: `[${i + 1}] ${content.references[i]}`,
        fontSize: 9,
        margin: [0, 0, 0, 3]
      } as ContentText)
    }
  }

  // Images (patent figures) for PDF
  if (content.images && content.images.length > 0) {
    for (let i = 0; i < content.images.length; i++) {
      const img = content.images[i]
      body.push({
        text: `【図${i + 1}】${img.label}`,
        fontSize: 11,
        bold: true,
        alignment: 'center',
        margin: [0, 20, 0, 5]
      } as ContentText)
      body.push({
        image: `data:image/png;base64,${img.data.toString('base64')}`,
        width: Math.min(img.width, 450),
        height: Math.min(img.height, 350),
        alignment: 'center',
        margin: [0, 0, 0, 15]
      } as unknown as Content)
    }
  }

  return {
    content: body,
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 11,
      lineHeight: 1.4
    },
    pageMargins: [60, 60, 60, 60],
    header: (currentPage: number, pageCount: number) => ({
      text: content.title,
      fontSize: 8,
      italics: true,
      alignment: 'right' as const,
      margin: [0, 20, 60, 0]
    }),
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      fontSize: 8,
      alignment: 'center' as const,
      margin: [0, 0, 0, 20]
    }),
    info: {
      title: content.title,
      author: content.authors?.join(', ') || 'RX Research App',
      creator: 'RX - Research Transformation'
    }
  }
}

function addPdfSection(body: Content[], section: Section, level: number): void {
  const fontSize = level === 1 ? 14 : level === 2 ? 12 : 11
  const marginTop = level === 1 ? 20 : 10

  body.push({
    text: section.heading,
    fontSize,
    bold: true,
    margin: [0, marginTop, 0, 5]
  } as ContentText)

  if (section.body) {
    const paragraphs = section.body.split('\n\n')
    for (const para of paragraphs) {
      if (para.trim()) {
        body.push({
          text: para.trim(),
          fontSize: 11,
          margin: [0, 0, 0, 8]
        } as ContentText)
      }
    }
  }

  if (section.subsections) {
    for (const sub of section.subsections) {
      addPdfSection(body, sub, level + 1)
    }
  }
}

// Singleton instance
export const documentGenerator = new DocumentGenerator()
