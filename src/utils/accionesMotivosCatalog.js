/**
 * Busca acción por su action_description en el catálogo de cat_acciones.
 * @param {Map<string, {action: string, descripcion: string}> | null} catalog
 * @param {string | null | undefined} descriptionValue - Valor de la celda (action_description)
 * @returns {{action: string, descripcion: string} | null}
 */
export function getAccionInfo(catalog, descriptionValue) {
  if (!catalog || descriptionValue === null || descriptionValue === undefined) return null;
  const trimmed = String(descriptionValue).trim();
  if (!trimmed) return null;
  return catalog.get(trimmed) || null;
}

/**
 * Busca motivo por su descripcion en el catálogo de cat_acciones_motivos.
 * @param {Map<string, {cd_motivo: string, descripcion_larga: string}> | null} catalog
 * @param {string | null | undefined} descriptionValue - Valor de la celda (descripcion)
 * @returns {{cd_motivo: string, descripcion_larga: string} | null}
 */
export function getMotivoInfo(catalog, descriptionValue) {
  if (!catalog || descriptionValue === null || descriptionValue === undefined) return null;
  const trimmed = String(descriptionValue).trim();
  if (!trimmed) return null;
  return catalog.get(trimmed) || null;
}
