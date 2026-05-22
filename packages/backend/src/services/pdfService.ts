/**
 * docx → PDF conversion that works on Render's standard Node runtime.
 *
 * LibreOffice (libreoffice-convert) is not installed on Render, so the
 * generated Word document is converted to HTML with `mammoth` and then
 * printed to PDF with the bundled Chromium via Puppeteer — both already
 * dependencies used elsewhere in the backend (PPT generation).
 *
 * Each stage is logged separately so a failure points at the culprit
 * (mammoth parse vs. Chromium launch vs. PDF print) in the Render logs.
 */
import mammoth from 'mammoth';
import puppeteer from 'puppeteer';
import { loggingService } from './loggingService';

// Print styling for the converted document — mammoth emits semantic
// HTML (h1-h4, p, ul/ol, table); this gives it a clean curriculum look.
const PAGE_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11pt;
         line-height: 1.55; color: #1f2937; margin: 0; }
  h1 { font-size: 21pt; color: #1F4788; margin: 0 0 8pt; }
  h2 { font-size: 15pt; color: #1F4788; margin: 20pt 0 6pt;
       border-bottom: 1px solid #d6d6d6; padding-bottom: 3pt; }
  h3 { font-size: 12.5pt; color: #2c3e50; margin: 14pt 0 4pt; }
  h4 { font-size: 11pt; color: #2c3e50; margin: 10pt 0 3pt; }
  p { margin: 0 0 7pt; }
  ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
  li { margin: 0 0 3pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }
  td, th { border: 1px solid #c9c9c9; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #f0f3f8; }
  img { max-width: 100%; }
  a { color: #1F4788; word-break: break-word; }
`;

/**
 * Convert a .docx buffer to a PDF buffer (A4, sensible print margins).
 *
 * The Chromium flags below keep memory low enough for Render's free
 * 512 MB instances: `--disable-dev-shm-usage` is essential — containers
 * give /dev/shm only ~64 MB and Chromium otherwise crashes mid-render.
 */
export async function docxBufferToPdf(docxBuffer: Buffer): Promise<Buffer> {
  // Stage 1 — docx → HTML.
  let bodyHtml: string;
  try {
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    bodyHtml = result.value;
    if (result.messages && result.messages.length) {
      loggingService.info('mammoth docx→html conversion notes', {
        count: result.messages.length,
      });
    }
  } catch (err) {
    loggingService.error('PDF export failed at mammoth docx→html stage', { err });
    throw err;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PAGE_STYLES}</style></head><body>${bodyHtml}</body></html>`;

  // Stage 2 — launch Chromium.
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      // Guard against a Chromium hang wedging the request indefinitely.
      protocolTimeout: 180000,
    });
  } catch (err) {
    loggingService.error('PDF export failed to launch Chromium', { err });
    throw err;
  }

  // Stage 3 — render the HTML and print to PDF.
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 120000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    });
    loggingService.info('PDF export rendered', { bytes: pdf.length });
    return Buffer.from(pdf);
  } catch (err) {
    loggingService.error('PDF export failed during Chromium render', { err });
    throw err;
  } finally {
    await browser.close().catch(() => {
      /* browser may already be gone — nothing to clean up */
    });
  }
}
