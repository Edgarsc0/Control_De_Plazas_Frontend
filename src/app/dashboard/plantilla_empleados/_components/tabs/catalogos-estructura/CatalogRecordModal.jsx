"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Save, Loader2, ShieldCheck } from "lucide-react";

function formatAuditDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Modal genérico de creación/edición/borrado para los 4 catálogos de
 * `catalogosConfig.js`. El formulario se arma a partir de `config.formFields`,
 * así que no hay que repetir JSX de inputs por catálogo.
 */
export default function CatalogRecordModal({ open, mode, config, initialValues, onClose, onSave, onDelete }) {
  const [values, setValues] = useState(initialValues || config?.emptyRecord || {});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValues(initialValues || config?.emptyRecord || {});
      setError("");
    }
  }, [open, initialValues, config]);

  if (!config) return null;

  const isEdit = mode === "edit";

  const handleChange = (field, raw) => {
    const value = field.type === "number" ? (raw === "" ? "" : raw) : raw;
    setValues((prev) => ({ ...prev, [field.key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {};
      config.formFields.forEach((f) => {
        let v = values[f.key];
        if (f.type === "number" && v !== "" && v !== null && v !== undefined) v = Number(v);
        payload[f.key] = v === "" ? null : v;
      });
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err?.message || "No se pudo guardar el registro. Verifica los datos e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar este registro de "${config.label}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setError("");
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err?.message || "No se pudo eliminar el registro.");
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <config.icon className="size-4 text-[#621f32]" />
              {isEdit ? `Editar registro · ${config.label}` : `Nuevo registro · ${config.label}`}
            </DialogTitle>
            <DialogDescription>
              Tabla física: <span className="font-mono">{config.tableName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            {config.formFields.map((f) => {
              const disabled = isEdit && f.disabledOnEdit;
              const value = values[f.key] ?? "";
              const isTextarea = f.type === "textarea";
              return (
                <div key={f.key} className={isTextarea ? "sm:col-span-2" : ""}>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </label>
                  {isTextarea ? (
                    <textarea
                      value={value}
                      required={f.required}
                      disabled={disabled}
                      onChange={(e) => handleChange(f, e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      step={f.step}
                      value={value}
                      required={f.required}
                      disabled={disabled}
                      maxLength={f.maxLength}
                      onChange={(e) => handleChange(f, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {isEdit && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] text-gray-500 font-medium mb-2">
              <ShieldCheck className="size-3.5 text-gray-400 shrink-0" />
              <span>
                Última modificación: <span className="font-bold text-gray-700">{initialValues?.modificado_por || "—"}</span>
                {" · "}{formatAuditDate(initialValues?.fecha_modificacion)}
              </span>
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">{error}</p>
          )}

          <DialogFooter className="flex items-center !justify-between gap-2 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase text-red-600 hover:bg-red-50 border border-red-100 transition-all disabled:opacity-40"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Eliminar
              </button>
            ) : <span />}
            <button
              type="submit"
              disabled={saving || deleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-[#621f32] text-white hover:bg-[#4d1827] transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {isEdit ? "Guardar Cambios" : "Crear Registro"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
