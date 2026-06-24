import type { jsPDF } from "jspdf";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

let fontDataPromise: Promise<{ regular: string; bold: string }> | null = null;

function loadFontData(): Promise<{ regular: string; bold: string }> {
  if (!fontDataPromise) {
    fontDataPromise = (async () => {
      const [regular, bold] = await Promise.all([
        fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
        fetch("/fonts/Roboto-Bold.ttf").then((r) => r.arrayBuffer()),
      ]);
      return {
        regular: arrayBufferToBase64(regular),
        bold: arrayBufferToBase64(bold),
      };
    })();
  }
  return fontDataPromise;
}

export async function registerRobotoFonts(doc: jsPDF): Promise<void> {
  const fonts = await loadFontData();
  doc.addFileToVFS("Roboto-Regular.ttf", fonts.regular);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", fonts.bold);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
}
