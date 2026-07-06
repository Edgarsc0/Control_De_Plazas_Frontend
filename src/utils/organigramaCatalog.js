/**
 * Busca nombre y nivel de un código de departamento en el catálogo de ORGANIGRAMA_ANAM.
 * @param {Map<string, {nombre: string, nivel: string}> | null} catalog
 * @param {string | number | null | undefined} code
 * @returns {{nombre: string, nivel: string} | null}
 */
export function getDeptoInfo(catalog, code) {
  if (!catalog || code === null || code === undefined) return null;
  const trimmed = String(code).trim();
  if (!trimmed) return null;
  return catalog.get(trimmed) || null;
}
