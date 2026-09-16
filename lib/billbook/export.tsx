'use client';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import DocumentPreview from '@/components/billbook/document-preview';
import { type BillDoc, typeNames, validateForExport } from './model';
import { documentText } from './calculations';
import { yieldToBrowser } from './scheduling';
const filename = (value: string) =>
  value.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '') || 'document';
export function download(data: Blob | string, name: string) {
  const blob =
    typeof data === 'string'
      ? new Blob([data], { type: 'application/json' })
      : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function capture(doc: BillDoc, copy: string) {
  await yieldToBrowser();
  const host = document.createElement('div');
  host.className = 'export-host';
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: '794px',
    zIndex: '-1',
  });
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<DocumentPreview doc={doc} copy={copy} />));
    await document.fonts.ready;
    await document.fonts.load(`14px "${doc.design.font}"`);
    await Promise.all(
      Array.from(host.querySelectorAll('img')).map((img) => img.decode()),
    );
    const node = host.querySelector('.paper') as HTMLElement;
    const rect = node.getBoundingClientRect();
    const boundaries = Array.from(node.querySelectorAll('.pdf-block'))
      .map((e) => Math.ceil(e.getBoundingClientRect().bottom - rect.top))
      .sort((a, b) => a - b);
    const canvas = await toCanvas(node, {
      pixelRatio: 2,
      backgroundColor: doc.design.background,
      cacheBust: false,
      skipAutoScale: false,
    });
    return { canvas, boundaries };
  } finally {
    root.unmount();
    host.remove();
  }
}
export async function makePDF(doc: BillDoc, copies = ['Original']) {
  const errors = validateForExport(doc);
  if (errors.length) throw new Error(errors[0]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let first = true;
  for (const copy of copies) {
    const { canvas, boundaries } = await capture(doc, copy);
    const margin = 8,
      usableWidth = 194,
      usableHeight = 277;
    const scale = canvas.width / 794;
    const maxHeight = (usableHeight / usableWidth) * canvas.width;
    let offset = 0,
      page = 0;
    while (offset < canvas.height) {
      await yieldToBrowser();
      if (!first) pdf.addPage();
      first = false;
      page++;
      const proposed = Math.min(offset + maxHeight, canvas.height);
      const safe = boundaries
        .map((b) => b * scale)
        .filter((b) => b > offset + 80 && b <= proposed);
      const end =
        proposed === canvas.height ? proposed : (safe.at(-1) ?? proposed);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.ceil(end - offset);
      const ctx = slice.getContext('2d');
      if (!ctx) throw new Error('Image export is unavailable in this browser.');
      ctx.fillStyle = doc.design.background;
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(
        canvas,
        0,
        offset,
        canvas.width,
        end - offset,
        0,
        0,
        canvas.width,
        end - offset,
      );
      pdf.addImage(
        slice.toDataURL('image/png'),
        'PNG',
        margin,
        margin,
        usableWidth,
        (slice.height / canvas.width) * usableWidth,
        undefined,
        'FAST',
      );
      pdf.setFontSize(8);
      pdf.setTextColor(135);
      pdf.text(`${doc.number} | ${copy} | Page ${page}`, 105, 290, {
        align: 'center',
      });
      offset = end;
    }
  }
  pdf.setProperties({
    title: doc.number,
    subject: typeNames[doc.type],
    author: doc.seller.name,
  });
  return pdf.output('blob');
}
export async function exportDocument(
  doc: BillDoc,
  format: 'pdf' | 'png' | 'text' | 'share' | 'print',
  copies = ['Original'],
) {
  const errors = validateForExport(doc);
  if (errors.length) throw new Error(errors.join('\n'));
  if (format === 'text') {
    await navigator.clipboard.writeText(documentText(doc, copies[0]));
    return;
  }
  if (format === 'share') {
    const text = documentText(doc, copies[0]);
    if (navigator.share) {
      await navigator.share({ title: doc.number, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
  if (format === 'png') {
    const { canvas } = await capture(doc, copies[0]);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not create image.'))),
        'image/png',
      ),
    );
    download(
      blob,
      `${filename(doc.number)}-${copies[0].toLowerCase().replaceAll(' ', '-')}.png`,
    );
    return;
  }
  const blob = await makePDF(doc, copies);
  download(blob, `${filename(doc.number)}.pdf`);
  if (format === 'print') return 'print-download';
}
export async function exportBulk(
  docs: BillDoc[],
  onProgress: (v: number) => void,
) {
  const errors = docs.flatMap((d) =>
    validateForExport(d).map((e) => `${d.number}: ${e}`),
  );
  if (errors.length) throw new Error(errors.slice(0, 3).join('\n'));
  const zip = new JSZip();
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const name = `${String(i + 1).padStart(3, '0')}_${filename(doc.number)}`;
    zip.file(`${name}.pdf`, await makePDF(doc));
    zip.file(`${name}.txt`, documentText(doc));
    onProgress(Math.round(((i + 1) / docs.length) * 100));
    await yieldToBrowser();
  }
  download(await zip.generateAsync({ type: 'blob' }), 'billbook-documents.zip');
}
