/** Opens the browser print dialog. No PDF dependency is required. */
export function printPage(): void {
  if (typeof window !== "undefined") window.print();
}
