import { apiFetch } from "@/lib/fetch-interceptor";

/**
 * CRUD de los catálogos de estructura organizacional administrados desde el
 * tab "Catálogos" de `plantilla_empleados`: cat_acciones, cat_acciones_motivos,
 * CAT_PTO_FUNC y rc_cat_cod_presupuestal. Todas las peticiones pasan por
 * `apiFetch`, que inyecta el token de sesión.
 */
export const CatalogoEstructuraService = {
    // ── cat_acciones (pk: action) ──────────────────────────────────────────
    getCatAcciones: (options = {}) => apiFetch("/plantilla/cat-acciones/", { method: "GET", ...options }),
    createCatAccion: (data, options = {}) => apiFetch("/plantilla/cat-acciones/", {
        method: "POST", body: JSON.stringify(data), ...options,
    }),
    updateCatAccion: (action, data, options = {}) => apiFetch(`/plantilla/cat-acciones/${encodeURIComponent(action)}/`, {
        method: "PUT", body: JSON.stringify(data), ...options,
    }),
    deleteCatAccion: (action, options = {}) => apiFetch(`/plantilla/cat-acciones/${encodeURIComponent(action)}/`, {
        method: "DELETE", ...options,
    }),

    // ── cat_acciones_motivos (pk: id autoincremental) ──────────────────────
    getCatAccionesMotivos: (options = {}) => apiFetch("/plantilla/cat-acciones-motivos/", { method: "GET", ...options }),
    createCatAccionMotivo: (data, options = {}) => apiFetch("/plantilla/cat-acciones-motivos/", {
        method: "POST", body: JSON.stringify(data), ...options,
    }),
    updateCatAccionMotivo: (id, data, options = {}) => apiFetch(`/plantilla/cat-acciones-motivos/${id}/`, {
        method: "PUT", body: JSON.stringify(data), ...options,
    }),
    deleteCatAccionMotivo: (id, options = {}) => apiFetch(`/plantilla/cat-acciones-motivos/${id}/`, {
        method: "DELETE", ...options,
    }),

    // ── CAT_PTO_FUNC (pk: id autoincremental) ──────────────────────────────
    getCatPtoFunc: (options = {}) => apiFetch("/plantilla/cat-pto-func/", { method: "GET", ...options }),
    createCatPtoFunc: (data, options = {}) => apiFetch("/plantilla/cat-pto-func/", {
        method: "POST", body: JSON.stringify(data), ...options,
    }),
    updateCatPtoFunc: (id, data, options = {}) => apiFetch(`/plantilla/cat-pto-func/${id}/`, {
        method: "PUT", body: JSON.stringify(data), ...options,
    }),
    deleteCatPtoFunc: (id, options = {}) => apiFetch(`/plantilla/cat-pto-func/${id}/`, {
        method: "DELETE", ...options,
    }),

    // ── rc_cat_cod_presupuestal (pk compuesta: codigo_presupuestal + escala) ─
    getCatCodPresupuestal: (options = {}) => apiFetch("/plantilla/cat-cod-presupuestal/", { method: "GET", ...options }),
    createCatCodPresupuestal: (data, options = {}) => apiFetch("/plantilla/cat-cod-presupuestal/", {
        method: "POST", body: JSON.stringify(data), ...options,
    }),
    updateCatCodPresupuestal: (codigoPresupuestal, escala, data, options = {}) => apiFetch(
        `/plantilla/cat-cod-presupuestal/${encodeURIComponent(codigoPresupuestal)}/${escala}/`,
        { method: "PUT", body: JSON.stringify(data), ...options }
    ),
    deleteCatCodPresupuestal: (codigoPresupuestal, escala, options = {}) => apiFetch(
        `/plantilla/cat-cod-presupuestal/${encodeURIComponent(codigoPresupuestal)}/${escala}/`,
        { method: "DELETE", ...options }
    ),

    // ── ORGANIGRAMA_ANAM (pk: departamento) ────────────────────────────────
    getOrganigramaAnam: (options = {}) => apiFetch("/plantilla/cat-organigrama-anam/", { method: "GET", ...options }),
    createOrganigramaAnam: (data, options = {}) => apiFetch("/plantilla/cat-organigrama-anam/", {
        method: "POST", body: JSON.stringify(data), ...options,
    }),
    updateOrganigramaAnam: (departamento, data, options = {}) => apiFetch(`/plantilla/cat-organigrama-anam/${encodeURIComponent(departamento)}/`, {
        method: "PUT", body: JSON.stringify(data), ...options,
    }),
    patchOrganigramaAnam: (departamento, data, options = {}) => apiFetch(`/plantilla/cat-organigrama-anam/${encodeURIComponent(departamento)}/`, {
        method: "PATCH", body: JSON.stringify(data), ...options,
    }),
    deleteOrganigramaAnam: (departamento, options = {}) => apiFetch(`/plantilla/cat-organigrama-anam/${encodeURIComponent(departamento)}/`, {
        method: "DELETE", ...options,
    }),

    // ── cat_nivel_jerarquico_plaza (pk: plaza) ─────────────────────────────
    getNivelesJerarquicosPlaza: (options = {}) => apiFetch("/plantilla/cat-nivel-jerarquico-plaza/", { method: "GET", ...options }),
    getNivelesJerarquicosOpciones: (options = {}) => apiFetch("/plantilla/cat-nivel-jerarquico-plaza/niveles/", { method: "GET", ...options }),
    bulkAssignNivelJerarquico: (plazas, descripcionNivelJerarquico, options = {}) => apiFetch("/plantilla/cat-nivel-jerarquico-plaza/bulk-assign/", {
        method: "POST",
        body: JSON.stringify({ plazas, descripcion_nivel_jerarquico: descripcionNivelJerarquico }),
        ...options,
    }),
    getNivelJerarquicoPrioridad: (options = {}) => apiFetch("/plantilla/cat-nivel-jerarquico-plaza/prioridad/", { method: "GET", ...options }),
    aplicarNivelJerarquicoPrioridad: (fuente, options = {}) => apiFetch("/plantilla/cat-nivel-jerarquico-plaza/aplicar-prioridad/", {
        method: "POST",
        body: JSON.stringify({ fuente }),
        ...options,
    }),
};
