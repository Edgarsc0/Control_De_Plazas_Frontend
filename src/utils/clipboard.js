/**
 * Copia texto al portapapeles funcionando también fuera de secure context.
 *
 * `navigator.clipboard` sólo existe en HTTPS o localhost; el despliegue de este
 * sistema corre por IP en HTTP plano, así que ahí la API no está disponible y
 * hay que caer al viejo `document.execCommand("copy")` sobre un textarea
 * temporal (mismo fallback que ya usan CopyCellMenu y EmpleadoTimelineModal).
 *
 * @param {string} text - Texto a copiar.
 * @returns {Promise<boolean>} `true` si se copió, `false` si ningún método funcionó.
 */
export async function copyToClipboard(text) {
  const value = text == null ? "" : String(text);

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Permiso denegado o contexto inseguro: se intenta el fallback.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
