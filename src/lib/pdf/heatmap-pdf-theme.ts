/** Shared PDF palette aligned with the in-app heatmap report UI. */
export const PDF_THEME = {
  primary: [37, 99, 235] as [number, number, number],
  primaryLight: [239, 246, 255] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate50: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  redLight: [254, 242, 242] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  greenLight: [240, 253, 244] as [number, number, number],
  margin: 36,
  pageWidth: 595,
  pageHeight: 842,
} as const;

export const PDF_CONTENT_WIDTH =
  PDF_THEME.pageWidth - PDF_THEME.margin * 2;
