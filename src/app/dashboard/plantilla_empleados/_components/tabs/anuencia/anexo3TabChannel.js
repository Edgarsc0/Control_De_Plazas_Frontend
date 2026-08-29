// El editor de Anexo 3 vive en su propia pestaña del navegador
// (/dashboard/plantilla_empleados/anexo3) para poder abrirse con
// `window.open` mientras se sigue viendo el Anexo 2. Una pestaña nueva no
// comparte memoria de JS con ésta, así que la captura de `hojas` se pasa UNA
// sola vez por localStorage (bajo una clave con un id al azar, generado al
// abrir) y el aviso de "ya se cerró" viaja por BroadcastChannel — ambos
// mecanismos son del mismo origen, sin pasar por el backend.

export const CANAL_ANEXO3 = "anuencia-anexo3-editor";

const PREFIJO_STORAGE = "anuencia-anexo3:";

const claveStorage = (id) => `${PREFIJO_STORAGE}${id}`;

export const guardarDatosAnexo3 = (id, datos) => {
    localStorage.setItem(claveStorage(id), JSON.stringify(datos));
};

export const leerDatosAnexo3 = (id) => {
    try {
        const crudo = localStorage.getItem(claveStorage(id));
        return crudo ? JSON.parse(crudo) : null;
    } catch {
        return null;
    }
};

export const borrarDatosAnexo3 = (id) => {
    localStorage.removeItem(claveStorage(id));
};
