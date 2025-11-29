import { PDFDocument } from 'pdf-lib';
import * as pdfjsLibProxy from 'pdfjs-dist';

// Fix for PDF.js import in ESM environments
// @ts-ignore
const pdfjsLib = pdfjsLibProxy.default || pdfjsLibProxy;

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

/**
 * Converts an array of image files to a single PDF.
 */
export const imagesToPdf = async (images: File[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();

  for (const image of images) {
    const imageBytes = await image.arrayBuffer();
    let pdfImage;
    
    // Check type to use correct embedding method
    if (image.type === 'image/jpeg' || image.type === 'image/jpg') {
      pdfImage = await pdfDoc.embedJpg(imageBytes);
    } else if (image.type === 'image/png') {
      pdfImage = await pdfDoc.embedPng(imageBytes);
    } else {
      continue; // Skip unsupported
    }

    const { width, height } = pdfImage.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return await pdfDoc.save();
};

/**
 * Merges multiple PDFs into one.
 */
export const mergePdfs = async (files: File[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const fileBytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(fileBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
};

/**
 * Splits a PDF based on page range string (e.g., "1-3, 5").
 * Note: Input is 1-based index, pdf-lib uses 0-based.
 */
export const splitPdf = async (file: File, rangeStr: string): Promise<Uint8Array> => {
  const fileBytes = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(fileBytes);
  const newPdf = await PDFDocument.create();
  const totalPages = srcPdf.getPageCount();

  const pagesToKeep = new Set<number>();

  const parts = rangeStr.split(',');
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(s => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) pagesToKeep.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(part.trim());
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pagesToKeep.add(pageNum - 1);
      }
    }
  });

  const indices = Array.from(pagesToKeep).sort((a, b) => a - b);
  
  if (indices.length === 0) {
      throw new Error("Invalid page range");
  }

  const copiedPages = await newPdf.copyPages(srcPdf, indices);
  copiedPages.forEach(page => newPdf.addPage(page));

  return await newPdf.save();
};

/**
 * Compresses a PDF by rendering pages to JPEG images and reconstructing the PDF.
 * This is a "destructive" compression (rasterization) which is very effective for scanned documents.
 * 
 * @param file The PDF file
 * @param quality 0.0 to 1.0 (JPEG quality)
 * @param onProgress Optional callback
 */
export const compressPdf = async (file: File, quality: number, onProgress?: (current: number, total: number) => void): Promise<Uint8Array> => {
  const fileArrayBuffer = await file.arrayBuffer();
  
  // Load PDF using PDF.js
  const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileArrayBuffer));
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const newPdfDoc = await PDFDocument.create();

  // Temporary canvas for rendering
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not create canvas context");

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages);

    const page = await pdf.getPage(i);
    
    // Determine scale - keep it reasonable to avoid massive memory usage but high enough for readability
    // 1.5 scale is roughly 108px per inch (assuming 72dpi base), good compromise
    const viewport = page.getViewport({ scale: 1.5 });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Convert to JPEG with specified quality
    // This is where compression happens
    const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
    const imageBytes = await fetch(imageDataUrl).then(res => res.arrayBuffer());

    const embeddedImage = await newPdfDoc.embedJpg(imageBytes);
    
    const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
    
    // Cleanup
    page.cleanup();
  }

  return await newPdfDoc.save();
};

// Helper to download blob
export const downloadPdf = (data: Uint8Array, filename: string) => {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};