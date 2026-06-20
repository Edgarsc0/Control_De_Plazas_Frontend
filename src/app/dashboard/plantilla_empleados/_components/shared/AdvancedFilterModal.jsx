import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Filter, Trash2, Settings2, ChevronDownIcon } from 'lucide-react';
import { OPERATORS, getColumnType } from '@/hooks/useAdvancedFilter';

function AutocompleteCombobox({ value, onChange, options, placeholder, disabled, isObject = false }) {
  const getDisplayValue = (val) => {
    if (isObject) {
      const opt = options?.find(o => o.key === val);
      return opt ? opt.label : '';
    }
    return val || '';
  };

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(getDisplayValue(value));
  const [filteredOptions, setFilteredOptions] = useState(options);
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!isOpen) {
      setSearch(getDisplayValue(value));
    }
  }, [value, isOpen, options, isObject]);

  useEffect(() => {
    if (!options) return;
    setFilteredOptions(
      options.filter(opt => {
        const text = isObject ? opt.label : opt;
        return String(text).toLowerCase().includes(String(search).toLowerCase());
      })
    );
  }, [search, options, isObject]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        if (menuRef.current && menuRef.current.contains(event.target)) {
          return;
        }
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen, filteredOptions]);

  // Ensure scroll of the modal updates the position
  useEffect(() => {
    const handleScroll = () => {
      if (isOpen && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  // Allow scrolling inside the portal when Radix Dialog is open
  useEffect(() => {
    const el = menuRef.current;
    if (el) {
      const stopScroll = (e) => e.stopPropagation();
      el.addEventListener('wheel', stopScroll, { passive: true });
      el.addEventListener('touchmove', stopScroll, { passive: true });
      return () => {
        el.removeEventListener('wheel', stopScroll);
        el.removeEventListener('touchmove', stopScroll);
      };
    }
  });


  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative w-full flex items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { 
            setSearch(e.target.value); 
            if (!isObject) onChange(e.target.value);
            setIsOpen(true); 
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-[38px] px-3 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] focus:ring-1 focus:ring-[#621f32]/30 disabled:opacity-50"
        />
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
          disabled={disabled}
        >
          <ChevronDownIcon className="size-4" />
        </button>
      </div>
      
      {isOpen && filteredOptions.length > 0 && !disabled && coords.width > 0 && typeof document !== 'undefined' && createPortal(
        <ul 
          ref={menuRef}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="custom-portal absolute z-[99999] max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-2xl custom-scrollbar py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: coords.top, left: coords.left, width: coords.width, pointerEvents: 'auto' }}
        >
          {filteredOptions.slice(0, 150).map((opt, idx) => {
            const optValue = isObject ? opt.key : opt;
            const optLabel = isObject ? opt.label : opt;
            return (
              <li 
                key={isObject ? opt.key : idx}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer truncate"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(optValue);
                  setSearch(optLabel);
                  setIsOpen(false);
                }}
              >
                {optLabel}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}

export function AdvancedFilterModal({ 
  isOpen, onClose, columns, data, rules, addRule, updateRule, removeRule, clearRules 
}) {
  
  // Calculate distinct values dynamically based on selected field
  const getDistinctValues = (fieldKey) => {
    if (!fieldKey || !data) return [];
    const unique = new Set(data.map(row => row[fieldKey]).filter(val => val !== null && val !== undefined && val !== ""));
    return Array.from(unique).sort();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        hideClose 
        onInteractOutside={(e) => { if (e.target.closest('.custom-portal')) e.preventDefault(); }}
        className="max-w-4xl p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-bottom-[2%] data-[state=closed]:animate-out data-[state=closed]:zoom-out-[0.98] data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-[2%] duration-500 ease-out"
      >
        <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] dark:from-[#3e131f] dark:to-[#621f32] rounded-xl text-white shadow-lg">
              <Settings2 className="size-5 text-[#bc955c]" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">Constructor de Consultas</DialogTitle>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Filtros Avanzados Logicos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all self-start">
            <X className="size-5" />
          </button>
        </DialogHeader>

        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col gap-4">
          {rules.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <div className="size-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <Filter className="size-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">No hay reglas definidas</h3>
              <p className="text-xs text-slate-400 mb-6">Agrega una condición para comenzar a filtrar tus datos dinámicamente.</p>
              <button onClick={addRule} className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2">
                <Plus className="size-4" /> Agregar Condición
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rules.map((rule, index) => {
                const fieldType = getColumnType(rule.field);
                const distinctValues = getDistinctValues(rule.field);
                
                return (
                  <div key={rule.id} className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 rounded-2xl relative group hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-colors">
                    
                    {/* Logic Operator (AND/OR) */}
                    {index > 0 ? (
                      <Select value={rule.logic} onValueChange={(val) => updateRule(rule.id, 'logic', val)}>
                        <SelectTrigger className="w-[100px] h-[38px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-black text-[#621f32] dark:text-[#bc955c] rounded-md outline-none ring-0 focus:ring-1 focus:ring-[#621f32]/30 shadow-none">
                          <SelectValue placeholder="Conector" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[300] rounded-md border-slate-200 dark:border-slate-700 shadow-xl">
                          <SelectItem value="AND" className="text-xs font-bold">Y (AND)</SelectItem>
                          <SelectItem value="OR" className="text-xs font-bold">O (OR)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="px-3 h-[38px] flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-black text-slate-400 min-w-[100px]">
                        DÓNDE
                      </div>
                    )}

                    {/* Field Selector */}
                    <div className="flex-1">
                      <AutocompleteCombobox
                        value={rule.field}
                        onChange={(val) => updateRule(rule.id, 'field', val)}
                        options={columns.filter(c => c.key && c.label)}
                        placeholder="Buscar columna..."
                        isObject={true}
                      />
                    </div>

                    {/* Operator Selector */}
                    <Select value={rule.operator} onValueChange={(val) => updateRule(rule.id, 'operator', val)} disabled={!rule.field}>
                      <SelectTrigger className="flex-[0.8] h-[38px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-bold text-[#621f32] dark:text-[#bc955c] rounded-md outline-none ring-0 focus:ring-1 focus:ring-[#621f32]/30 shadow-none truncate">
                        <SelectValue placeholder="Operador..." />
                      </SelectTrigger>
                      <SelectContent position="popper" className="z-[300] rounded-md border-slate-200 dark:border-slate-700 shadow-xl">
                        {OPERATORS[fieldType].map(op => (
                          <SelectItem key={op.value} value={op.value} className="text-xs font-medium">{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Value Input */}
                    {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                      <div className="flex-[1.5] w-full flex items-center gap-2">
                        <Select value={rule.valueType || 'VALUE'} onValueChange={(val) => { updateRule(rule.id, 'valueType', val); updateRule(rule.id, 'value', ''); }}>
                          <SelectTrigger className="w-[85px] h-[38px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 rounded-md outline-none ring-0 shadow-none shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" className="z-[300] rounded-md border-slate-200 dark:border-slate-700 shadow-xl">
                            <SelectItem value="VALUE" className="text-xs font-bold">Valor</SelectItem>
                            <SelectItem value="FIELD" className="text-xs font-bold">Campo</SelectItem>
                          </SelectContent>
                        </Select>

                        {rule.valueType === 'FIELD' ? (
                          <div className="flex-1">
                            <AutocompleteCombobox
                              value={rule.value}
                              onChange={(val) => updateRule(rule.id, 'value', val)}
                              options={columns.filter(c => c.key && c.label && c.key !== rule.field)}
                              placeholder="Buscar columna..."
                              isObject={true}
                            />
                          </div>
                        ) : fieldType === 'DATE' ? (
                          <input 
                            type="date"
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                            className="w-full h-[38px] px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#621f32]/30"
                          />
                        ) : (
                          <AutocompleteCombobox
                            value={rule.value}
                            onChange={(val) => updateRule(rule.id, 'value', val)}
                            options={distinctValues}
                            placeholder={rule.field ? "Escribe o selecciona..." : "..."}
                            disabled={!rule.field}
                          />
                        )}
                      </div>
                    )}

                    {/* Remove Rule Button */}
                    <button 
                      onClick={() => removeRule(rule.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto sm:ml-0 shrink-0"
                      title="Eliminar condición"
                    >
                      <Trash2 className="size-4" />
                    </button>

                  </div>
                );
              })}
              
              <div className="mt-2 flex items-center justify-between">
                <button onClick={addRule} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                  <Plus className="size-3" /> Agregar otra condición
                </button>
                <button onClick={clearRules} className="px-4 py-2 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Limpiar Todo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cerrar
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-[#621f32] to-[#8d2c48] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[#621f32]/20 hover:opacity-90 active:scale-95 transition-all">
            Ver Resultados
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
