'use client';

import { collectCodenames } from '@/config/permissionTree';
import { PERMISSION_PREVIEWS } from '@/config/permissionPreviews';

/**
 * Fila de un permiso dentro del árbol (checkbox + nombre real del backend +
 * línea de ayuda opcional), con recursión para sus hijos (indentados).
 */
function PermissionNodeRow({
    node,
    depth,
    permsByCodename,
    selectedPermissionIds,
    togglePermission,
    previewCodename,
    setPreviewCodename,
}) {
    const perm = permsByCodename.get(node.codename);
    if (!perm) return null; // permiso ya no existe en el catálogo del backend

    const hasPreview = Boolean(PERMISSION_PREVIEWS[perm.full_codename]);
    const isChecked = selectedPermissionIds.has(perm.id);

    return (
        <div>
            <label
                onMouseEnter={() => hasPreview && setPreviewCodename(perm.full_codename)}
                onFocus={() => hasPreview && setPreviewCodename(perm.full_codename)}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
            >
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePermission(perm.id)}
                    className="mt-0.5 accent-[#621f32]"
                />
                <span className={depth === 0 ? 'text-sm font-semibold text-slate-800' : 'text-sm text-slate-700'}>
                    {perm.name}
                </span>
            </label>
            {node.info && (
                <p
                    className="text-[11px] text-slate-400 italic -mt-0.5 mb-1"
                    style={{ paddingLeft: `${0.5 + depth * 1.25 + 1.5}rem` }}
                >
                    {node.info}
                </p>
            )}
            {(node.children || []).map((child) => (
                <PermissionNodeRow
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    permsByCodename={permsByCodename}
                    selectedPermissionIds={selectedPermissionIds}
                    togglePermission={togglePermission}
                    previewCodename={previewCodename}
                    setPreviewCodename={setPreviewCodename}
                />
            ))}
        </div>
    );
}

/**
 * Sección de un módulo completo (ej. "Plantilla de Empleados"): encabezado +
 * "Seleccionar todos" del módulo entero, y sus nodos de permiso recursivos.
 */
export default function PermissionTreeSection({
    moduleNode,
    permsByCodename,
    selectedPermissionIds,
    togglePermission,
    toggleManyIds,
    previewCodename,
    setPreviewCodename,
}) {
    const moduleIds = collectCodenames(moduleNode)
        .map((cn) => permsByCodename.get(cn)?.id)
        .filter((id) => id !== undefined);

    if (moduleIds.length === 0) return null; // ningún permiso de este módulo existe en el catálogo actual

    const allSelected = moduleIds.every((id) => selectedPermissionIds.has(id));

    return (
        <div>
            <div className="flex items-center justify-between px-2 mb-1">
                <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    {moduleNode.label}
                </h4>
                <button
                    type="button"
                    onClick={() => toggleManyIds(moduleIds, allSelected)}
                    className="text-[11px] font-bold text-[#621f32] hover:underline cursor-pointer"
                >
                    {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                </button>
            </div>
            {moduleNode.info && (
                <p className="px-2 -mt-0.5 mb-1.5 text-[11px] text-slate-400 italic">
                    {moduleNode.info}
                </p>
            )}
            <div className="space-y-0.5">
                {(moduleNode.children || []).map((node) => (
                    <PermissionNodeRow
                        key={node.id}
                        node={node}
                        depth={0}
                        permsByCodename={permsByCodename}
                        selectedPermissionIds={selectedPermissionIds}
                        togglePermission={togglePermission}
                        previewCodename={previewCodename}
                        setPreviewCodename={setPreviewCodename}
                    />
                ))}
            </div>
        </div>
    );
}
