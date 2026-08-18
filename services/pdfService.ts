import html2pdf from 'html2pdf.js';

export interface PdfOptions {
  filename: string;
  margin?: number | [number, number, number, number];
}

export const generarPdfDesdeElemento = async (element: HTMLElement, opts: PdfOptions): Promise<Blob> => {
  // Save current scroll position
  const originalScrollX = window.scrollX || window.pageXOffset || 0;
  const originalScrollY = window.scrollY || window.pageYOffset || 0;

  // Temporarily scroll to (0,0) to prevent html2canvas scrollY offset clipping
  window.scrollTo(0, 0);

  // Create a temporary top-left fixed container attached directly to document.body
  // This guarantees top: 0, left: 0 coordinates regardless of parent modal styling or page height
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '800px';
  container.style.zIndex = '999999';
  container.style.background = '#ffffff';
  container.style.opacity = '1';
  container.style.visibility = 'visible';
  container.style.pointerEvents = 'none';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.opacity = '1';
  clone.style.position = 'static';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.margin = '0 auto';
  clone.style.transform = 'none';
  clone.style.width = '800px';
  clone.style.background = '#ffffff';
  clone.style.color = '#000000';

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    const worker = html2pdf()
      .set({
        margin: opts.margin !== undefined ? opts.margin : [6, 6, 6, 6],
        filename: opts.filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          windowWidth: 1200,
          windowHeight: 1600,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(clone);

    // Extract PDF instance cleanly for both html2pdf v0.10.x and v0.14.x
    const pdfInstance = await worker.toPdf().get('pdf');
    const blob = pdfInstance.output('blob');
    return blob as Blob;
  } catch (err) {
    console.warn('Fallback to direct output blob:', err);
    const worker = html2pdf()
      .set({
        margin: [6, 6, 6, 6],
        filename: opts.filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(clone);
    const blob = await worker.output('blob');
    return blob as Blob;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Restore original scroll position
    window.scrollTo(originalScrollX, originalScrollY);
  }
};

export const descargarBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
