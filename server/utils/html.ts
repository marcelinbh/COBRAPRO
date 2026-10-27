/**
 * Codifica texto não confiável antes de interpolá-lo em um contexto HTML.
 * Não use para atributos de URL: eles exigem validação de protocolo/origem própria.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
