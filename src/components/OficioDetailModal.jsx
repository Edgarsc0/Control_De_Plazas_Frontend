'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  FileText,
  CheckCircle2,
  Info,
  User,
  Building2,
  ClipboardList,
  Search,
  ChevronRight,
  X,
  Tag,
  ExternalLink,
  File,
  Paperclip,
  Loader2,
  FileSearch,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CatTipoOficioService } from '@/services/cat_tipo_oficio.service';
import Select from 'react-select';
import { customSelectStyles } from './OficioSelectStyles';


const DetailSection = ({
  icon: Icon,
  title,
  children,
  fullWidth = false,
}) => (
  <div
    className={`bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60 shadow-sm space-y-4 transition-all hover:shadow-md hover:bg-white/50 ${fullWidth ? 'col-span-full' : ''}`}
  >
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm text-[#621f32] border border-gray-100">
        <Icon className="size-4" />
      </div>
      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
        {title}
      </h4>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const DataItem = ({ label, value, icon: Icon, highlight = false }) => (
  <div className="flex flex-col gap-1 group">
    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
      {Icon && <Icon className="size-2.5 opacity-50" />}
      {label}
    </span>
    <div
      className={`text-[13px] font-bold leading-tight ${highlight ? 'text-[#621f32]' : 'text-gray-800'}`}
    >
      {value || (
        <span className="text-gray-300 font-normal italic">
          No especificado
        </span>
      )}
    </div>
  </div>
);

const DetailModal = ({
  item,
  expediente,
  isLoading,
  pdfUrl,
  isPreviewing,
  onPreview,
  onClose,
  onUpdate,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}) => {
  if (!item) return null;

  const config = {
    atendido: {
      bg: 'bg-[#621f32]/5',
      text: 'text-[#621f32]',
      fill: 'bg-[#621f32]',
      border: 'border-[#621f32]/20',
      icon: CheckCircle2,
    },
    concluido: {
      bg: 'bg-[#621f32]/5',
      text: 'text-[#621f32]',
      fill: 'bg-[#621f32]',
      border: 'border-[#621f32]/20',
      icon: CheckCircle2,
    },
    recibido: {
      bg: 'bg-[#bc955c]/10',
      text: 'text-[#bc955c]',
      fill: 'bg-[#bc955c]',
      border: 'border-[#bc955c]/20',
      icon: Info,
    },
    Default: {
      bg: 'bg-gray-50',
      text: 'text-gray-500',
      fill: 'bg-gray-400',
      border: 'border-gray-100',
      icon: FileText,
    },
  };

  const statusStyle =
    config[item.statusTurnado?.toLowerCase()] || config.Default;

  const model = expediente?.model || {};

  const [tiposAsunto, setTiposAsunto] = useState([]);
  const [selectedTipoAsunto, setSelectedTipoAsunto] = useState('');
  const [currentRelacionId, setCurrentRelacionId] = useState(null);
  const [isUpdatingTipo, setIsUpdatingTipo] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tipos, relaciones] = await Promise.all([
          CatTipoOficioService.getTiposAsunto(),
          CatTipoOficioService.getRelacionesAsuntoOficio(item.idAsunto),
        ]);

        setTiposAsunto(Array.isArray(tipos) ? tipos : tipos.results || []);

        const currentRelacion = Array.isArray(relaciones)
          ? relaciones[0]
          : relaciones.results && relaciones.results[0];

        if (currentRelacion) {
          setSelectedTipoAsunto(currentRelacion.idTipoAsunto);
          setCurrentRelacionId(currentRelacion.id);
        } else {
          setSelectedTipoAsunto('');
          setCurrentRelacionId(null);
        }
      } catch (error) {
        console.error('Error fetching tipos de asunto:', error);
      }
    };

    if (item?.idAsunto) {
      fetchData();
    }
  }, [item?.idAsunto]);

  const handleTipoAsuntoChange = async (selectedOption) => {
    if (!selectedOption) {
      // Intentar borrar la clasificación
      if (selectedTipoAsunto === 1) {
        const confirmDelete = window.confirm(
          "Al quitar esta clasificación se eliminará el registro de Valuación Presupuestaria asociado a este asunto. ¿Está seguro de continuar?"
        );
        if (!confirmDelete) return;
      }

      setIsUpdatingTipo(true);
      try {
        if (currentRelacionId) {
          await CatTipoOficioService.deleteRelacionAsuntoOficio(currentRelacionId);
        }
        setSelectedTipoAsunto('');
        setCurrentRelacionId(null);
        if (onUpdate) {
          onUpdate(item.idTurnado, null);
        }
      } catch (error) {
        console.error('Error deleting relación:', error);
      } finally {
        setIsUpdatingTipo(false);
      }
      return;
    }

    const value = selectedOption?.value;
    const label = selectedOption?.label;
    if (!value) return;

    setIsUpdatingTipo(true);
    try {
      const resp = await CatTipoOficioService.createRelacionAsuntoOficio(
        item.idAsunto,
        value,
      );
      setSelectedTipoAsunto(value);
      setCurrentRelacionId(resp.id);
      if (onUpdate) {
        onUpdate(item.idTurnado, label);
      }
    } catch (error) {
      console.error('Error creating relación:', error);
    } finally {
      setIsUpdatingTipo(false);
    }
  };

  useEffect(() => {
    console.log('Expediente Model:', model);
    console.log('Item: ', item)
    console.log("Id Asunto: ", item.idAsunto);
  }, []);

  // Format options for react-select
  const tipoOptions = tiposAsunto.map((tipo) => ({
    value: tipo.id,
    label: tipo.nombre,
  }));

  const selectedOption = tipoOptions.find(opt => opt.value === selectedTipoAsunto) || null;

  // Custom styles override for this specific modal header
  const headerSelectStyles = {
    ...customSelectStyles,
    container: (base) => ({
      ...base,
      width: '240px',
    }),
    control: (base, state) => ({
      ...customSelectStyles.control(base, state),
      backgroundColor: 'transparent',
      border: 'none',
      boxShadow: 'none',
      minHeight: '32px',
      '&:hover': {
        border: 'none',
      },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 10000001 }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 8px',
    }),
    singleValue: (base) => ({
      ...base,
      fontSize: '10px',
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#621f32',
    }),
    placeholder: (base) => ({
      ...base,
      fontSize: '10px',
      fontWeight: '800',
      textTransform: 'uppercase',
    })
  };

  // RENDER PORTAL TO BODY
  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 md:p-8 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 40, opacity: 0 }}
        className="relative w-full max-w-[95vw] h-[90vh] bg-white rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col border border-gray-100"
      >
        {/* Header */}
        <div className="px-10 py-6 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 relative z-10 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#621f32] rounded-2xl shadow-lg">
              <FileText className="size-6 text-[#bc955c]" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[9px] font-black text-[#bc955c] uppercase tracking-[0.4em]">
                  Expediente Digital Integrado
                </span>
                <div
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} flex items-center gap-2`}
                >
                  <div
                    className={`size-1.5 rounded-full ${statusStyle.fill} animate-pulse`}
                  />
                  {item.statusTurnado}
                </div>
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                {item.asuntoFolio}
                <span className="text-gray-300 font-light">/</span>
                <span className="text-base text-gray-400 font-mono font-bold tracking-normal">
                  {item.asuntoNoOficio}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* TIPO DE ASUNTO SELECTOR - MORE STRIKING DESIGN */}
            <div className="relative flex items-center gap-2 bg-gradient-to-r from-white to-gray-50/50 pl-4 pr-1 py-1 rounded-2xl border-2 border-[#621f32]/20 shadow-[0_4px_20px_-4px_rgba(98,31,50,0.1)] group hover:border-[#621f32]/40 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2 mr-1">
                <div className="p-1.5 bg-[#621f32] rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                  <Tag className="size-3 text-[#bc955c]" />
                </div>
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter hidden xl:block">
                  Clasificar:
                </span>
              </div>
              
              <Select
                styles={headerSelectStyles}
                options={tipoOptions}
                value={selectedOption}
                onChange={handleTipoAsuntoChange}
                isDisabled={isUpdatingTipo}
                placeholder="Seleccionar tipo..."
                menuPortalTarget={document.body}
                menuPlacement="auto"
                isSearchable={false}
                isClearable={true}
              />

              {isUpdatingTipo && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                   <Loader2 className="size-3 text-[#621f32] animate-spin" />
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-100 mx-2" />

            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              <button
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="p-2.5 bg-white hover:bg-[#621f32] border border-gray-100 shadow-sm rounded-xl text-gray-400 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-gray-400 group/nav"
                title="Anterior"
              >
                <ChevronRight className="size-5 rotate-180 group-hover/nav:scale-110 transition-transform" />
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="p-2.5 bg-white hover:bg-[#621f32] border border-gray-100 shadow-sm rounded-xl text-gray-400 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-gray-400 group/nav"
                title="Siguiente"
              >
                <ChevronRight className="size-5 group-hover/nav:scale-110 transition-transform" />
              </button>
            </div>

            <div className="w-px h-8 bg-gray-100 mx-2" />

            <button
              onClick={onClose}
              className="p-3 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all group"
            >
              <X className="size-6 text-gray-400 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>

        {/* Content Split View */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel: PDF Viewer */}
          <div className="w-1/2 bg-gray-100/50 border-r border-gray-100 relative flex flex-col">
            {isPreviewing ? (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <Loader2 className="size-8 text-[#621f32] animate-spin" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Cargando Documento...
                </span>
              </div>
            ) : null}

            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-none"
                title="Visor de Documento"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-4">
                <FileSearch className="size-16 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest opacity-40">
                  Seleccione un archivo para visualizar
                </p>
              </div>
            )}

            {/* Quick Actions overlay for the PDF */}
            {pdfUrl && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-md rounded-xl shadow-2xl">
                <button
                  onClick={() => window.open(pdfUrl, '_blank')}
                  className="flex items-center gap-2 text-[9px] font-black text-white uppercase tracking-widest hover:text-[#bc955c] transition-colors"
                >
                  <ExternalLink className="size-3" />
                  Abrir en pestaña nueva
                </button>
              </div>
            )}
          </div>

          {/* Right Panel: Metadata and Messages */}
          <div className="w-1/2 flex flex-col overflow-y-auto custom-scrollbar bg-gray-50/30">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 className="size-10 text-[#621f32] animate-spin" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Consultando Servidor...
                </p>
              </div>
            ) : (
              <div className="p-10 space-y-10">
                {/* Description and Synthesis */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#621f32]/5 rounded-xl text-[#621f32]">
                      <ClipboardList className="size-5" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-800">
                      Asunto descripción
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed font-medium">
                    {item.asuntoDescripcion}
                  </p>
                  <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-50">
                    <DataItem
                      label="Remitente"
                      value={item.asuntoRemitente}
                      icon={User}
                    />
                    <DataItem
                      label="Tema"
                      value={item._asuntoTema?.tema || item.asuntoTema}
                      highlight
                      icon={Tag}
                    />
                  </div>
                </div>

                {/* Files Section */}
                {(model.documentos?.length > 0 ||
                  model.respuestas?.length > 0 ||
                  model.anexos?.length > 0) && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <div className="p-2 bg-[#621f32]/5 rounded-xl text-[#621f32]">
                          <Search className="size-4" />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                          Archivos del Expediente
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {model.documentos?.map((doc) => (
                          <button
                            key={doc.idDocumentoAsunto}
                            onClick={() => onPreview(doc.ruta || doc.nombre)}
                            className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-[#621f32]/30 hover:shadow-md transition-all group text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[#621f32]/5 rounded-lg text-[#621f32]">
                                <File className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-gray-700 truncate max-w-[250px]">
                                  {doc.nombre}
                                </span>
                                <span className="text-[8px] text-gray-400 font-bold uppercase">
                                  {doc.tipoDocumento}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-gray-300 group-hover:text-[#621f32] transition-colors" />
                          </button>
                        ))}
                        {model.respuestas?.map((resp) => (
                          <button
                            key={resp.idDocumentoTurnado}
                            onClick={() => onPreview(resp.ruta || resp.nombre)}
                            className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-emerald-500/30 hover:shadow-md transition-all group text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                <FileText className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-gray-700 truncate max-w-[250px]">
                                  {resp.nombre}
                                </span>
                                <span className="text-[8px] text-gray-400 font-bold uppercase">
                                  Respuesta Turnado #{resp.consecutivoTurnado}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-gray-300 group-hover:text-emerald-600 transition-colors" />
                          </button>
                        ))}
                        {model.anexos?.map((anexo, idx) => (
                          <button
                            key={idx}
                            onClick={() => onPreview(anexo.ruta || anexo.nombre)}
                            className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-[#bc955c]/30 hover:shadow-md transition-all group text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[#bc955c]/5 rounded-lg text-[#bc955c]">
                                <Paperclip className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-gray-700 truncate max-w-[250px]">
                                  {anexo.nombre || 'Anexo'}
                                </span>
                                <span className="text-[8px] text-gray-400 font-bold uppercase">
                                  Anexo Digital
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-gray-300 group-hover:text-[#bc955c] transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <DetailSection icon={User} title="Remitente">
                    <DataItem label="Nombre" value={item.asuntoRemitente} />
                    <DataItem
                      label="Dependencia"
                      value={item.asuntoRemitenteDependencia}
                    />
                  </DetailSection>

                  <DetailSection icon={Building2} title="Dirigido A">
                    <DataItem label="Nombre" value={item.asuntoDirigidoA} />
                    <DataItem
                      label="Unidad"
                      value={item.asuntoDirigidoADependencia}
                    />
                  </DetailSection>
                </div>

                <DetailSection
                  icon={Tag}
                  title="Turnado Institucional"
                  fullWidth
                >
                  <div className="grid grid-cols-2 gap-8">
                    <DataItem
                      label="Unidad Responsable"
                      value={item.nombreUnidadResponsable}
                      highlight
                    />
                    <DataItem
                      label="Instrucción"
                      value={
                        item.nombreInstruccionCruzada || item.nombreInstruccion
                      }
                    />
                  </div>
                </DetailSection>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
};

export default DetailModal;
