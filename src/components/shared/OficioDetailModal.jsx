'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Info,
  User,
  Building2,
  ClipboardList,
  Search,
  ChevronRight,
  ChevronLeft,
  Tag,
  ExternalLink,
  File,
  Paperclip,
  Loader2,
  FileSearch,
} from 'lucide-react';
import { CatTipoOficioService } from '@/services/cat_tipo_oficio.service';
import Select from 'react-select';
import { customSelectStyles } from './OficioSelectStyles';
import ModalShell from './ModalShell';


const DetailSection = ({
  icon: Icon,
  title,
  children,
  fullWidth = false,
}) => (
  <div
    className={`bg-white dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 transition-all hover:shadow-md ${fullWidth ? 'col-span-full' : ''}`}
  >
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-[#621f32]/5 dark:bg-[#621f32]/20 rounded-xl shadow-sm text-[#621f32] dark:text-[#bc955c] border border-[#621f32]/10 dark:border-[#621f32]/30">
        <Icon className="size-4" />
      </div>
      <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
        {title}
      </h4>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const DataItem = ({ label, value, icon: Icon, highlight = false }) => (
  <div className="flex flex-col gap-1 group">
    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
      {Icon && <Icon className="size-2.5 opacity-50" />}
      {label}
    </span>
    <div
      className={`text-[13px] font-bold leading-tight ${highlight ? 'text-[#621f32] dark:text-[#e3c793]' : 'text-slate-800 dark:text-slate-200'}`}
    >
      {value || (
        <span className="text-slate-300 dark:text-slate-700 font-normal italic">
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

  return (
    <ModalShell
      open
      onClose={onClose}
      size="xl"
      icon={FileText}
      eyebrow="Expediente digital integrado"
      title={item.asuntoFolio}
      subtitle={item.asuntoNoOficio}
    >
      <div className="flex flex-col gap-4">
        {/* Barra de estatus + clasificación + navegación */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} flex items-center gap-2`}
            >
              <div className={`size-1.5 rounded-full ${statusStyle.fill} animate-pulse`} />
              {item.statusTurnado}
            </div>

            <div className="relative flex items-center gap-2 bg-white dark:bg-slate-900 pl-3 pr-1 py-1 rounded-2xl border border-[#621f32]/20 dark:border-slate-700 shadow-sm group hover:border-[#621f32]/40 transition-all">
              <div className="flex items-center gap-2 mr-1">
                <div className="p-1.5 bg-[#621f32] rounded-lg shadow-sm">
                  <Tag className="size-3 text-[#bc955c]" />
                </div>
                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter hidden xl:block">
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
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPlacement="auto"
                isSearchable={false}
                isClearable={true}
              />

              {isUpdatingTipo && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-3 text-[#621f32] animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="p-2 bg-white dark:bg-slate-950 hover:bg-[#621f32] border border-slate-100 dark:border-slate-800 shadow-sm rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-950 disabled:hover:text-slate-400 cursor-pointer"
              title="Anterior"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-2 bg-white dark:bg-slate-950 hover:bg-[#621f32] border border-slate-100 dark:border-slate-800 shadow-sm rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-950 disabled:hover:text-slate-400 cursor-pointer"
              title="Siguiente"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Visor de documento + metadata */}
        <div className="flex flex-col lg:flex-row gap-4 lg:h-[62vh] rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
          <div className="lg:w-1/2 h-64 lg:h-full bg-slate-50 dark:bg-slate-900/40 relative flex flex-col shrink-0">
            {isPreviewing ? (
              <div className="absolute inset-0 z-20 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <Loader2 className="size-8 text-[#621f32] animate-spin" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Cargando documento...
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
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-4">
                <FileSearch className="size-16 opacity-30" />
                <p className="text-xs font-black uppercase tracking-widest opacity-50">
                  Seleccione un archivo para visualizar
                </p>
              </div>
            )}

            {pdfUrl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-slate-950/85 backdrop-blur-md rounded-xl shadow-2xl">
                <button
                  onClick={() => window.open(pdfUrl, '_blank')}
                  className="flex items-center gap-2 text-[9px] font-black text-white uppercase tracking-widest hover:text-[#bc955c] transition-colors cursor-pointer"
                >
                  <ExternalLink className="size-3" />
                  Abrir en pestaña nueva
                </button>
              </div>
            )}
          </div>

          <div className="lg:w-1/2 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <Loader2 className="size-10 text-[#621f32] animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Consultando servidor...
                </p>
              </div>
            ) : (
              <div className="p-5 sm:p-7 space-y-7">
                {/* Description and Synthesis */}
                <div className="bg-white dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#621f32]/5 dark:bg-[#621f32]/20 rounded-xl text-[#621f32] dark:text-[#bc955c]">
                      <ClipboardList className="size-5" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-200">
                      Asunto descripción
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {item.asuntoDescripcion}
                  </p>
                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
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
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 px-1">
                        <div className="p-2 bg-[#621f32]/5 dark:bg-[#621f32]/20 rounded-xl text-[#621f32] dark:text-[#bc955c]">
                          <Search className="size-4" />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                          Archivos del Expediente
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {model.documentos?.map((doc) => (
                          <button
                            key={doc.idDocumentoAsunto}
                            onClick={() => onPreview(doc.ruta || doc.nombre)}
                            className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-[#621f32]/30 hover:shadow-md transition-all group text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[#621f32]/5 dark:bg-[#621f32]/20 rounded-lg text-[#621f32] dark:text-[#bc955c]">
                                <File className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[250px]">
                                  {doc.nombre}
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                                  {doc.tipoDocumento}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-slate-300 dark:text-slate-700 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c] transition-colors" />
                          </button>
                        ))}
                        {model.respuestas?.map((resp) => (
                          <button
                            key={resp.idDocumentoTurnado}
                            onClick={() => onPreview(resp.ruta || resp.nombre)}
                            className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 hover:shadow-md transition-all group text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                <FileText className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[250px]">
                                  {resp.nombre}
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                                  Respuesta Turnado #{resp.consecutivoTurnado}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-slate-300 dark:text-slate-700 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                          </button>
                        ))}
                        {model.anexos?.map((anexo, idx) => (
                          <button
                            key={idx}
                            onClick={() => onPreview(anexo.ruta || anexo.nombre)}
                            className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-[#bc955c]/30 hover:shadow-md transition-all group text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[#bc955c]/10 dark:bg-[#bc955c]/20 rounded-lg text-[#bc955c]">
                                <Paperclip className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[250px]">
                                  {anexo.nombre || 'Anexo'}
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                                  Anexo Digital
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-slate-300 dark:text-slate-700 group-hover:text-[#bc955c] transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  <div className="grid grid-cols-2 gap-6">
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
      </div>
    </ModalShell>
  );
};

export default DetailModal;
