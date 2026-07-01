// Client-side barcode decode from a captured still image. Cross-browser via ZXing (the native
// BarcodeDetector API is absent on iOS Safari + Firefox, which rules it out for a real user base).
// Dynamically imported so the ~library only loads in the browser when a photo is actually scanned.
// Returns the numeric UPC/EAN string, or null when the image has no readable barcode.

export async function decodeBarcodeFromImage(dataUrl: string): Promise<string | null> {
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(dataUrl);
    const text = result.getText().replace(/\D/g, '');
    // UPC-E(8) / EAN-8 / UPC-A(12) / EAN-13 / GTIN-14
    return /^\d{8,14}$/.test(text) ? text : null;
  } catch {
    return null; // NotFoundException etc. -> no barcode in the frame
  }
}
