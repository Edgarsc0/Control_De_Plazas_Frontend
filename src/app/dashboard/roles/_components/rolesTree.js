/**
 * Orden del árbol de roles, compartido por la tabla de Roles, la de Usuarios
 * y los listados del banner: padre → hijos, con los titulares en el orden del
 * catálogo de unidades.
 */

/** Aplana el árbol en orden padre → hijos (por nombre), anotando la profundidad. */
export function aplanarArbol(roles) {
    const ids = new Set(roles.map((r) => r.id));
    const hijosDe = new Map();
    for (const role of roles) {
        // Un padre que no vino en la lista se trata como raíz, para no perder el rol.
        const clave = role.padre && ids.has(role.padre) ? role.padre : null;
        if (!hijosDe.has(clave)) hijosDe.set(clave, []);
        hijosDe.get(clave).push(role);
    }
    // Titulares primero, en el orden del catálogo (cd_un y luego cd_ua); el
    // resto (subroles, transversales) por nombre.
    const ordenar = (lista) =>
        [...lista].sort((a, b) => {
            const ta = a.tipo === 'titular' ? 0 : 1;
            const tb = b.tipo === 'titular' ? 0 : 1;
            if (ta !== tb) return ta - tb;
            if (ta === 0) {
                const porUn = String(a.cd_un).localeCompare(String(b.cd_un));
                return porUn || String(a.cd_ua).localeCompare(String(b.cd_ua));
            }
            return a.name.localeCompare(b.name, 'es');
        });
    const filas = [];
    const visitar = (role, depth, ancestros) => {
        const hijos = ordenar(hijosDe.get(role.id) || []);
        filas.push({ role, depth, ancestros, numHijos: hijos.length });
        hijos.forEach((hijo) => visitar(hijo, depth + 1, [...ancestros, role.id]));
    };
    ordenar(hijosDe.get(null) || []).forEach((raiz) => visitar(raiz, 0, []));
    return filas;
}

/** id de rol -> posición en el árbol, para ordenar otras listas igual que él. */
export function ordenDeRoles(roles) {
    return new Map(aplanarArbol(roles).map(({ role }, i) => [role.id, i]));
}
