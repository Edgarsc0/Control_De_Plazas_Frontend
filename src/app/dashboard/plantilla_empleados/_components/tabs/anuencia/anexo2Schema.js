// Estructura del "ANEXO 2. SOLICITUD DE OCUPACIÓN DE PLAZAS Y/O CONTRATACIÓN
// DE HONORARIOS" (formato de la Unidad de Diseño Presupuestario, Control y
// Seguimiento del Gasto). Fuente única compartida por la captura en pantalla
// (AnuenciaTab.jsx) y por la exportación a .xlsx (anexo2Excel.js), para que
// el archivo generado no pueda desviarse de lo que el usuario vio.
//
// Los anchos vienen del archivo original (columnas B..M de la hoja
// "DGOA - DGMEIA", en unidades de carácter de Excel); en pantalla se
// convierten a px con PX_POR_CARACTER.

export const PX_POR_CARACTER = 8;

/**
 * Las 12 columnas del cuadro de plazas, en el orden exacto del formato.
 * - `key`: nombre del campo en el objeto de fila.
 * - `anchoExcel`: ancho de columna del .xlsx original (columnas B..M).
 * - `tipo`: cómo se captura en pantalla.
 * - `autollenado`: lo resuelve el backend a partir del Código Federal de
 *   Puesto (ver AnuenciaLookupView); sigue siendo editable a mano.
 */
export const ANEXO2_COLUMNAS = [
    { key: 'ramo', label: 'Ramo', anchoExcel: 7.0, tipo: 'texto', autollenado: true },
    { key: 'unidad_responsable', label: 'Unidad Responsable', anchoExcel: 15.14, tipo: 'texto', autollenado: true },
    {
        key: 'codigo',
        label: 'Código Federal de Puesto / Identificador de plaza eventual / Folio Honorarios',
        anchoExcel: 28.43,
        tipo: 'texto',
        // Es la llave de captura: escribirla dispara el autollenado del resto.
        esLlave: true,
    },
    { key: 'denominacion_puesto', label: 'Denominación del puesto', anchoExcel: 38.57, tipo: 'texto', autollenado: true },
    { key: 'nivel_salarial', label: 'Nivel Salarial', anchoExcel: 13.71, tipo: 'texto', autollenado: true },
    { key: 'rango_salarial', label: 'Rango Salarial', anchoExcel: 15.29, tipo: 'texto', autollenado: true },
    { key: 'numero_plazas', label: 'Número de plazas', anchoExcel: 13.14, tipo: 'numero', autollenado: true },
    { key: 'numero_horas', label: 'Número de Horas', anchoExcel: 15.86, tipo: 'numero' },
    {
        key: 'tipo_contratacion',
        label: 'Tipo de contratación (Permanente, Eventual, Honorarios)',
        anchoExcel: 26.0,
        // Texto libre, no combobox: muestra tal cual lo que resuelve el
        // backend a partir del código (Permanente/Eventual/Honorarios), pero
        // el capturista puede corregirlo a mano si el dato no aplica.
        tipo: 'texto',
        autollenado: true,
    },
    {
        key: 'fecha_inicio_vacancia',
        label: 'Fecha de inicio de la vacancia',
        anchoExcel: 16.14,
        // Se autollena con la MISMA fecha calculada que muestra Mov.
        // Posiciones > Tabla Principal (ver AnuenciaLookupView,
        // _get_fecha_vacancia_bulk_map) y mientras no se edite a mano ofrece
        // un clic para abrir ese mismo modal de Detalle de Vacancia; editable
        // en todo momento (ver `_fechaVacanciaEditada` y AnuenciaTab.jsx).
        tipo: 'fecha_vacancia',
        autollenado: true,
    },
    { key: 'fecha_alta_solicitada', label: 'Fecha de alta solicitada', anchoExcel: 18.0, tipo: 'fecha' },
    { key: 'oficio_autorizacion', label: 'Oficio de autorización presupuestaria', anchoExcel: 34.0, tipo: 'texto' },
];

// Textos fijos del formato — se reproducen literalmente en pantalla y en el
// .xlsx exportado (son parte del documento oficial, no decoración).
export const ANEXO2_TEXTOS = {
    dependencia: 'UNIDAD DE DISEÑO PRESUPUESTARIO, CONTROL Y SEGUIMIENTO DEL GASTO',
    titulo: 'ANEXO 2. SOLICITUD DE OCUPACIÓN DE PLAZAS Y/O CONTRATACIÓN DE HONORARIOS',
    instruccion: 'Proporcionar el detalle de las plazas que se contratarán atendiendo el contenido de la siguiente tabla:',
    notaResponsabilidad: '* La información que se reporta en el presente formato es responsabilidad del ejecutor de gasto',
    tituloJustificacion:
        'Justificación para la ocupación de la plaza/contrato, implicaciones de no llevar a cabo la ocupación (razones por las cuales es indispensable para la operación del ejecutor de gasto la ocupación de la plaza o la celebración del contrato respectivo):',
    notaLegible: 'Requisitar en formato legible, en altas y bajas',
};

// Firma al pie del formato (celda combinada F23:I24 en el archivo original)
// — nombre y puesto de quien firma la solicitud. Ambos editables: el valor
// por defecto es sólo quién ocupa el puesto hoy, no un dato fijo del formato.
export const ANEXO2_FIRMA_DEFAULT = {
    nombre: 'Claudia Elizabeth De La Vega Madrigal',
    puesto: 'Directora de Recursos Humanos',
};

// Nombre de archivo por defecto (sin extensión) — el usuario puede
// personalizarlo desde el front; el mismo texto se usa como título visible
// del anexo ("Anuencia - {nombre}") y como nombre del .xlsx descargado.
export const ANEXO2_NOMBRE_ARCHIVO_DEFAULT = 'Anexo 2 solicitud de ocupación de plazas';

// Todas las plazas Eventuales del Anexo 2 se autorizan con este mismo
// oficio — no varía de una plaza a otra (a diferencia del resto de las
// columnas autollenado, que sí dependen de cada Código Federal de Puesto).
// Usado tanto por AnuenciaTab.jsx (autollenado en pantalla) como por
// AgregarAAnexo2Modal.jsx (autollenado al agregar plazas desde Mov.
// Posiciones) — una sola fuente para no desincronizarlos.
export const OFICIO_AUTORIZACION_EVENTUAL = '411/UDPCSG/2026/00621';

/** Id local, sólo para el `key` de React y para ubicar filas/hojas al
 * editarlas; nunca se exporta al .xlsx (sí se persiste en el JSON del
 * historial, por comodidad al recargar un anexo guardado). */
const nuevoId = (prefijo) =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Orden jerárquico de los grupos de nivel (columna "Nivel Salarial"): primero
// H, K, A, S, D, P en ese orden exacto, y al final los niveles "operativos"
// (sin letra, sólo número, p. ej. "2", "8", "11"). Dentro de cada grupo se
// ordena de MAYOR a MENOR por el número (K119, K117, K115, K109, ...) — la
// misma regla para todos los grupos, incluido el de operativos.
const GRUPOS_NIVEL_ORDEN = ['H', 'K', 'A', 'S', 'D', 'P'];

/**
 * Clasifica un nivel salarial para poder ordenarlo — `null` significa "no
 * aplica esta regla" (nivel vacío, como en las plazas de LAUDO que no traen
 * nivel, o un prefijo de letra que no está contemplado en `GRUPOS_NIVEL_ORDEN`):
 * esas filas "no se consideran" para el ordenamiento y se dejan al final,
 * en el orden en que ya estaban entre sí.
 */
const clasificarNivel = (nivelCrudo) => {
    const nivel = String(nivelCrudo || '').trim().toUpperCase();
    if (!nivel) return null;

    const soloNumero = /^(\d+)$/.exec(nivel);
    if (soloNumero) {
        return { grupo: GRUPOS_NIVEL_ORDEN.length, numero: Number(soloNumero[1]) };
    }

    const conLetra = /^([A-Z]+)(\d+)$/.exec(nivel);
    if (conLetra) {
        const indiceGrupo = GRUPOS_NIVEL_ORDEN.indexOf(conLetra[1]);
        if (indiceGrupo === -1) return null;
        return { grupo: indiceGrupo, numero: Number(conLetra[2]) };
    }

    return null;
};

/**
 * Reordena las filas de UNA hoja según la jerarquía de niveles (ver
 * `clasificarNivel`) — se llama cada vez que el nivel de una fila queda
 * fijo (autollenado desde el código, o corrección manual), nunca en cada
 * tecla mientras se escribe otra cosa. Las filas sin nivel reconocible
 * quedan al final, sin reordenarse entre ellas.
 */
export const ordenarFilasPorNivel = (filas) => {
    const clasificadas = filas.map((fila, indice) => ({ fila, indice, clave: clasificarNivel(fila.nivel_salarial) }));
    const conNivel = clasificadas.filter((c) => c.clave !== null);
    const sinNivel = clasificadas.filter((c) => c.clave === null).sort((a, b) => a.indice - b.indice);

    conNivel.sort((a, b) => (a.clave.grupo !== b.clave.grupo ? a.clave.grupo - b.clave.grupo : b.clave.numero - a.clave.numero));

    return [...conNivel, ...sinNivel].map((c) => c.fila);
};

/** Fila vacía del cuadro — todas las columnas en blanco. */
export const crearFilaVacia = () =>
    ANEXO2_COLUMNAS.reduce((fila, col) => ({ ...fila, [col.key]: '' }), {
        _id: nuevoId('fila'),
        // id de MOV_POS resuelto por el autollenado — respalda el clic en
        // "Fecha de inicio de la vacancia" (ver `tipo: 'fecha_vacancia'`
        // arriba). Tampoco se exporta al .xlsx (no es una columna del Anexo 2).
        _movPosId: null,
        // true en cuanto el usuario edita la fecha a mano — a partir de ahí
        // deja de ser "la fecha calculada" y por lo tanto deja de abrir el
        // modal de Detalle de Vacancia al hacer clic (ver AnuenciaTab.jsx).
        _fechaVacanciaEditada: false,
    });

// --- Hojas del libro ---------------------------------------------------
// Un Anexo 2 puede cubrir varias Unidades Administrativas, cada una con su
// propio cuadro de plazas y su propia justificación: eso es una HOJA, y cada
// una se vuelve una pestaña del .xlsx generado (ver anexo2Excel.js).

/** Límite de Excel para el nombre de una pestaña. */
export const NOMBRE_HOJA_MAX = 31;

// Excel rechaza estos caracteres en el nombre de una hoja; se filtran al
// escribir (ver AnuenciaTab.jsx) para que lo que se ve en pantalla sea
// exactamente el nombre que tendrá la pestaña en el archivo.
const CARACTERES_INVALIDOS_HOJA = /[\\/?*[\]:]/g;

/**
 * Deja un nombre de hoja utilizable por Excel: sin caracteres prohibidos y
 * dentro del límite de 31 caracteres. NO resuelve duplicados — de eso se
 * encarga la exportación, que es donde importa que sean únicos.
 */
export const sanitizarNombreHoja = (nombre) =>
    String(nombre ?? '').replace(CARACTERES_INVALIDOS_HOJA, '').slice(0, NOMBRE_HOJA_MAX);

/** Hoja vacía: una pestaña con su cuadro (una fila en blanco) y su propia UA/justificación. */
export const crearHojaVacia = (nombre = 'Hoja 1') => ({
    _id: nuevoId('hoja'),
    nombre: sanitizarNombreHoja(nombre) || 'Hoja 1',
    unidad_administrativa: '',
    justificacion: '',
    filas: [crearFilaVacia()],
    // UAs que el autollenado fue detectando en ESTA hoja, en orden de
    // aparición — se concatenan con " y " para armar el encabezado (ver
    // AnuenciaTab.jsx), igual que el formato de referencia ("DGOA y DGMEIA").
    _unidades_detectadas: [],
});

/**
 * Nombre libre para una hoja nueva ("Hoja 1", "Hoja 2", ...) que no choque
 * con los ya usados — se salta los números ocupados en vez de sólo contar
 * las hojas, para no repetir nombre tras borrar una de en medio.
 */
export const siguienteNombreHoja = (hojas) => {
    const usados = new Set((hojas || []).map((h) => String(h.nombre || '').trim().toLowerCase()));
    let n = (hojas?.length || 0) + 1;
    while (usados.has(`hoja ${n}`)) n += 1;
    return `Hoja ${n}`;
};
