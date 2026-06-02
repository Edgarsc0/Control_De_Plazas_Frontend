'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Counter,
  Chip,
  MiniBars,
  Sparkline,
  PieChart,
  IconBox,
  SankeyChart,
} from './BentoMiniComponents';
import { LayoutGrid, FileText, ChevronRight, Users } from 'lucide-react';
import LoadingOverlay from './LoadingOverlay';

export function VacantesPorNivelResumen({
  resumenVacantes,
  target = 14392,
  data: defaultData = [
    { label: 'Activos', percent: 0.65, color: '#621f32' },
    { label: 'Vacantes', percent: 0.15, color: '#bc955c' },
    { label: 'Otros', percent: 0.2, color: '#4a1726' },
  ],
}) {
  const [isLoading, setIsLoading] = useState(false);

  const redirectTo = (url) => {
    setIsLoading(true);
    window.location.href = url;
  };

  // Si tenemos resumenVacantes, transformamos los datos para la gráfica
  let displayData = defaultData;
  let displayTarget = target;

  if (resumenVacantes) {
    const total = resumenVacantes.total_registros || 1;
    displayTarget = resumenVacantes.total_registros || 0;

    // Agrupamos el resto como "Otros" (Suspendido, Permiso, etc.)
    const otrosCount =
      (resumenVacantes.Suspendido || 0) +
      (resumenVacantes.Permiso_Retribuido || 0) +
      (resumenVacantes.Permiso || 0);

    displayData = [
      {
        label: 'Activos',
        percent: (resumenVacantes.Activo || 0) / total,
        color: '#621f32',
      },
      {
        label: 'Vacantes',
        percent: (resumenVacantes.Vacante || 0) / total,
        color: '#bc955c',
      },
      {
        label: 'Otros',
        percent: otrosCount / total,
        color: '#4a1726',
      },
    ];
  }

  return (
    <>
      <LoadingOverlay
        isLoading={isLoading}
        text="Preparando vista detallada..."
      />
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32,
        }}
      >
        {/* Lado Izquierdo: Header, Título y Números */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            flex: 1.2,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
              }}
            >
              <IconBox
                icon={LayoutGrid}
                color="#621f32"
                bg="rgba(98,31,50,0.1)"
              />
            </div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#111827',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Vacantes por nivel
            </h2>
            <p
              style={{
                fontSize: 13,
                color: '#9ca3af',
                margin: '4px 0 0',
                lineHeight: 1.4,
              }}
            >
              Visualización de estatus de nómina por nivel.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              marginTop: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  color: '#621f32',
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}
              >
                <Counter target={resumenVacantes?.total_niveles || 0} />
              </span>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#621f32',
                  margin: '4px 0 0',
                }}
              >
                Niveles
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid #e5e7eb',
                paddingLeft: 14,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: '#111827',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                <Counter target={displayTarget} />
              </span>
              <p
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#9ca3af',
                  margin: '2px 0 0',
                }}
              >
                Registros totales
              </p>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Gráfica Destacada */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            background: 'rgba(0,0,0,0.03)',
            padding: '24px 32px',
            borderRadius: 28,
            height: '100%',
          }}
        >
          <PieChart data={displayData} size={110} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayData.map((item) => (
              <div
                key={item.label}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.color,
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    lineHeight: 1,
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}
                  >
                    {Math.round(item.percent * 100)}%
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function OcupacionVacantes({
  value = '98.6%',
  chipLabel = '+2.1%',
  values = [42, 58, 51, 70, 64, 80, 75, 90, 84, 100],
  color = '#d97706',
  resumenOcupacion,
}) {
  const redirectTo = (url) => {
    window.location.href = url;
  };

  const sankeyData = useMemo(() => {
    if (!resumenOcupacion || !resumenOcupacion.filas) return null;

    const levels = resumenOcupacion.columnas.filter(
      (c) =>
        c !== 'Of. De Solicitud' && c !== 'Total Resultado' && c !== '(vacío)',
    );

    const nodes = [];
    const links = [];
    const targetMap = new Map();

    // Target nodes (Niveles)
    levels.forEach((lvl) => {
      const id = `t-${lvl}`;
      targetMap.set(lvl, id);
      nodes.push({ id, name: lvl, group: 'target', value: 0 });
    });

    // Filter out "Total Resultado" row and rows with 0 total
    const dataFilas = resumenOcupacion.filas.filter(
      (f) =>
        f['Of. De Solicitud'] !== 'Total Resultado' && f['Total Resultado'] > 0,
    );

    dataFilas.forEach((fila, i) => {
      const sourceName =
        fila['Of. De Solicitud'] === '(vacío)'
          ? 'Sin Oficio'
          : fila['Of. De Solicitud'];
      const sourceId = `s-${i}`;

      let sourceValue = 0;
      levels.forEach((lvl) => {
        const val = fila[lvl] || 0;
        if (val > 0) {
          sourceValue += val;
          links.push({
            source: sourceId,
            target: targetMap.get(lvl),
            value: val,
            color:
              lvl === 'P33'
                ? '#621f32'
                : lvl === 'D312'
                  ? '#bc955c'
                  : lvl === 'P13'
                    ? '#9ca3af'
                    : undefined,
          });
          // Update target node value
          const targetNode = nodes.find((n) => n.id === targetMap.get(lvl));
          if (targetNode) targetNode.value += val;
        }
      });

      if (sourceValue > 0) {
        nodes.push({
          id: sourceId,
          name: sourceName,
          group: 'source',
          value: sourceValue,
        });
      }
    });

    return { nodes, links };
  }, [resumenOcupacion]);

  const totalPlazas = resumenOcupacion?.total_general || 1857;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#111827',
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              <Counter target={totalPlazas} />
            </span>
            <Chip label={`${(resumenOcupacion?.ocupadas_sig || 0).toLocaleString()} Ocupadas`} />
          </div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#9ca3af',
              margin: 0,
            }}
          >
            Distribución por Oficio y Nivel
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#621f32' }}>
            {resumenOcupacion?.filas?.length - 1 || 0}
          </span>
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#9ca3af',
              textTransform: 'uppercase',
            }}
          >
            Oficios
          </p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 280,
          background: 'rgba(0,0,0,0.02)',
          borderRadius: 20,
          padding: '10px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {sankeyData ? (
          <SankeyChart data={sankeyData} width={500} height={280} />
        ) : (
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            Cargando datos de ocupación...
          </p>
        )}
      </div>
    </div>
  );
}

export function OficiosTurnadosDO({
  oficiosTurnados,
  color = '#621f32',
  pendingColor = '#bc955c',
}) {
  const { distribucionPorStatus = [], detalleTurnados = [] } =
    oficiosTurnados?.model || {};

  // Calculate oficios turnados today
  const hoyCount = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    return detalleTurnados.filter((item) => {
      if (!item.fechaRegistro) return false;
      const itemDate = new Date(item.fechaRegistro).toLocaleDateString('en-CA');
      return itemDate === today;
    }).length;
  }, [detalleTurnados]);

  // Color mapping per status
  const statusColorMap = useMemo(() => {
    const map = {};
    const statuses = distribucionPorStatus.map(s => s.statusTurnado).filter(Boolean);
    const palette = [
      '#621f32', // Guinda
      '#bc955c', // Oro
      '#3b82f6', // Azul
      '#10b981', // Verde
      '#8b5cf6', // Morado
      '#ec4899', // Rosa
      '#f59e0b', // Naranja
      '#14b8a6', // Teal
      '#f43f5e', // Rose
    ];

    // First pass: assign explicit known statuses to distinct colors
    statuses.forEach((status) => {
      const s = status.toLowerCase();
      if (s === 'concluido') {
        map[status] = '#10b981'; // Verde (Concluido)
      } else if (s === 'atendido') {
        map[status] = '#621f32'; // Guinda (Atendido)
      } else if (s === 'recibido') {
        map[status] = '#bc955c'; // Oro (Recibido)
      } else if (s === 'en proceso' || s === 'proceso') {
        map[status] = '#3b82f6'; // Azul (En proceso)
      } else if (s === 'en trámite' || s === 'en tramite' || s === 'trámite' || s === 'tramite') {
        map[status] = '#8b5cf6'; // Morado (En trámite)
      }
    });

    // Second pass: assign unique remaining colors to other statuses
    let paletteIndex = 0;
    statuses.forEach((status) => {
      if (!map[status]) {
        const usedColors = Object.values(map);
        const availableColors = palette.filter(c => !usedColors.includes(c));
        if (availableColors.length > 0) {
          map[status] = availableColors[0];
        } else {
          map[status] = palette[paletteIndex % palette.length];
          paletteIndex++;
        }
      }
    });
    return map;
  }, [distribucionPorStatus]);

  // Pie chart data formatting
  const pieData = useMemo(() => {
    const data = distribucionPorStatus.map((s) => {
      return {
        label: s.statusTurnado,
        percent: s.porcentaje / 100,
        color: statusColorMap[s.statusTurnado] || '#94a3b8',
      };
    });
    return data.length > 0
      ? data
      : [{ label: 'Sin Datos', percent: 1, color: '#e5e7eb' }];
  }, [distribucionPorStatus, statusColorMap]);

  const total = detalleTurnados.length || 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#111827',
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              <Counter target={total} />
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: hoyCount > 0 ? '#10b981' : '#94a3b8',
              }}
            >
              +{hoyCount} hoy
            </span>
          </div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#9ca3af',
              margin: '4px 0 0',
            }}
          >
            Total de Oficios
          </p>
        </div>

        {/* Small Pie Chart in corner if activity today */}
        {hoyCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                lineHeight: 1,
              }}
            >
              {distribucionPorStatus.map((s) => (
                <span
                  key={s.statusTurnado}
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: statusColorMap[s.statusTurnado] || '#94a3b8',
                  }}
                >
                  {s.cantidad} {s.statusTurnado}
                </span>
              ))}
            </div>
            <PieChart data={pieData} size={54} />
          </div>
        )}

        {/* Placeholder if no activity today */}
        {hoyCount === 0 && (
          <IconBox icon={FileText} color={color} bg={`${color}1A`} />
        )}
      </div>

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {hoyCount === 0 ? (
          /* LARGE PIE CHART VIEW */
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 32,
              background: 'rgba(0,0,0,0.02)',
              borderRadius: 24,
              padding: '20px',
            }}
          >
            <PieChart data={pieData} size={160} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {distribucionPorStatus.map((s) => {
                const statusColor = statusColorMap[s.statusTurnado] || '#94a3b8';
                return (
                  <div
                    key={s.statusTurnado}
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: statusColor,
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        lineHeight: 1.1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: '#111827',
                        }}
                      >
                        {s.cantidad}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#9ca3af',
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.statusTurnado}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* LIST VIEW (MAX 4) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: '#bc955c',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 4,
              }}
            >
              Turnados Recientemente
            </p>
            {detalleTurnados.slice(0, 4).map((oficio) => (
              <div
                key={oficio.idTurnado}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #f1f5f9',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                }}
              >
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                >
                  <span
                    style={{ fontSize: 11, fontWeight: 900, color: '#1e293b' }}
                    title={oficio.asuntoNoOficio}
                  >
                    {oficio.asuntoNoOficio}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      maxWidth: '200px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {oficio.asuntoTema || 'Sin Tema'}
                  </span>
                </div>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <ChevronRight size={12} color="#94a3b8" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TransparencyContent({
  status = 'Cumplimiento al día',
  stats = [
    { label: 'Rendición de Cuentas', value: 97, color: '#0f766e' },
    { label: 'Auditorías Completadas', value: 84, color: '#0284c7' },
    { label: 'Documentación Digital', value: 91, color: '#7c3aed' },
  ],
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#10b981',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
          {status}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                {label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>
                {value}%
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: '#f3f4f6' }}>
              <div
                style={{
                  height: '100%',
                  width: `${value}%`,
                  borderRadius: 99,
                  background: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlantillaEmpleados({ resumenEmpleados }) {
  console.log('PlantillaEmpleados resumenEmpleados:', resumenEmpleados);
  const defaultData = [
    { label: 'Activo', percent: 0.79, color: '#621f32' },
    { label: 'Vacante', percent: 0.20, color: '#bc955c' },
    { label: 'Suspendido', percent: 0.002, color: '#3b82f6' },
    { label: 'Licencia', percent: 0.001, color: '#8b5cf6' },
    { label: 'Licencia Médica', percent: 0.005, color: '#10b981' },
  ];

  let displayData = defaultData;
  let displayTotal = 11957;
  let activosCount = 9421;

  if (resumenEmpleados) {
    const total = resumenEmpleados.total_registros || 1;
    displayTotal = resumenEmpleados.total_registros || 0;
    activosCount = resumenEmpleados.Activo || 0;

    displayData = [
      {
        label: 'Activo',
        percent: (resumenEmpleados.Activo || 0) / total,
        color: '#621f32',
      },
      {
        label: 'Vacante',
        percent: (resumenEmpleados.Vacante || 0) / total,
        color: '#bc955c',
      },
      {
        label: 'Suspendido',
        percent: (resumenEmpleados.Suspendido || 0) / total,
        color: '#3b82f6',
      },
      {
        label: 'Licencia',
        percent: (resumenEmpleados.Licencia || 0) / total,
        color: '#8b5cf6',
      },
      {
        label: 'Licencia Médica',
        percent: (resumenEmpleados.Licencia_Medica || 0) / total,
        color: '#10b981',
      },
    ];
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
      }}
    >
      {/* Lado Izquierdo: Header, Título y Números */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          flex: 1.2,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <IconBox
              icon={Users}
              color="#621f32"
              bg="rgba(98,31,50,0.1)"
            />
          </div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#111827',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Plantilla de Empleados
          </h2>
          <p
            style={{
              fontSize: 13,
              color: '#9ca3af',
              margin: '4px 0 0',
              lineHeight: 1.4,
            }}
          >
            Visualización y estado actual del personal de la ANAM.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            marginTop: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: '#621f32',
                lineHeight: 1,
                letterSpacing: '-0.04em',
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
              }}
            >
              <Counter target={activosCount} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#9ca3af' }}>
                ({displayTotal > 0 ? Math.round((activosCount / displayTotal) * 100) : 0}%)
              </span>
            </span>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#621f32',
                margin: '4px 0 0',
              }}
            >
              Activos
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid #e5e7eb',
              paddingLeft: 14,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#111827',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              <Counter target={displayTotal} />
            </span>
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#9ca3af',
                margin: '2px 0 0',
              }}
            >
              Posiciones Activas
            </p>
          </div>
        </div>
      </div>

      {/* Lado Derecho: Gráfica Destacada */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          background: 'rgba(0,0,0,0.03)',
          padding: '24px 32px',
          borderRadius: 28,
          height: '100%',
        }}
      >
        <PieChart data={displayData} size={110} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayData.map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: item.color,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  lineHeight: 1,
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}
                >
                  {item.percent < 0.01 && item.percent > 0
                    ? `${(item.percent * 100).toFixed(1)}%`
                    : `${Math.round(item.percent * 100)}%`}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                  }}
                >
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SecurityContent({
  integrity = '100%',
  tags = ['Cifrado AES-256', '2FA Activo', 'Auditoría'],
  values = [90, 95, 93, 98, 97, 99, 98, 100, 99, 100],
  color = '#15803d',
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: '#111827',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            {integrity}
          </span>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#9ca3af',
              margin: '4px 0 0',
            }}
          >
            Integridad de Datos
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 5,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          {tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '4px 9px',
                borderRadius: 99,
                background: 'rgba(21,128,61,0.1)',
                color: '#15803d',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        <Sparkline values={values} color={color} />
      </div>
    </div>
  );
}

export function ConnectivityContent({
  sla = '99.97%',
  chipLabel = '+0.3%',
  systems = [
    { name: 'API', ok: true },
    { name: 'DB', ok: true },
    { name: 'Auth', ok: true },
    { name: 'CDN', ok: true },
    { name: 'SAT', ok: false },
    { name: 'IMSS', ok: true },
  ],
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: '#111827',
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}
        >
          {sla}
        </span>
        <Chip label={chipLabel} />
      </div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#9ca3af',
          margin: 0,
        }}
      >
        Disponibilidad SLA
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
        {systems.map(({ name, ok }) => (
          <span
            key={name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 99,
              background: ok
                ? 'rgba(124,58,237,0.08)'
                : 'rgba(245,158,11,0.12)',
              color: ok ? '#7c3aed' : '#d97706',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: ok ? '#7c3aed' : '#f59e0b',
                display: 'inline-block',
              }}
            />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PresupuestarVolumenContent() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
      }}
    >
      {/* Header con Meses */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          paddingBottom: 8,
          borderBottom: '2px solid #e5e7eb',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280' }}>
          Nivel
        </div>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280' }}>
          No. Plazas
        </div>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280' }}>
          Sueldo
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          Meses
        </div>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280' }}>
          S. Colectivo
        </div>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280' }}>
          Compens.
        </div>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280' }}>
          Compens. Colec.
        </div>
      </div>
    </div>
  );
}

// ─── Organigrama Preview ───────────────────────────────────────────────────────
const LEVEL_COLORS = {
  General:    { bg: '#6d28d9', text: '#fff', line: '#7c3aed' },
  Central:    { bg: '#1d4ed8', text: '#fff', line: '#2563eb' },
  Director:   { bg: '#0891b2', text: '#fff', line: '#06b6d4' },
  'Subdir.':  { bg: '#d97706', text: '#fff', line: '#f59e0b' },
  Jefe:       { bg: '#059669', text: '#fff', line: '#10b981' },
};

function MiniNode({ label, level, children, isLast }) {
  const colors = LEVEL_COLORS[level] || LEVEL_COLORS['Jefe'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* Card */}
      <div style={{
        background: colors.bg,
        color: colors.text,
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 9,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        boxShadow: `0 2px 8px ${colors.bg}55`,
        letterSpacing: 0.2,
        minWidth: 70,
        textAlign: 'center',
      }}>
        {label}
      </div>

      {/* Children branch */}
      {children && children.length > 0 && (
        <>
          {/* Vertical down */}
          <div style={{ width: 2, height: 10, background: colors.line }} />
          {/* Horizontal connector */}
          {children.length > 1 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                right: '50%',
                height: 2,
                background: colors.line,
                width: `calc(100% - 36px)`,
                marginLeft: 18,
                transform: 'translateX(-50%)',
              }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {children.map((child, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 2, height: 8, background: colors.line }} />
                <MiniNode {...child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrganigramaPreviewContent() {
  const tree = {
    label: 'Dir. General', level: 'General',
    children: [
      {
        label: 'Dir. Central A', level: 'Central',
        children: [
          { label: 'Dirección 1', level: 'Director', children: [
            { label: 'Subdir. 1', level: 'Subdir.', children: [] },
            { label: 'Subdir. 2', level: 'Subdir.', children: [] },
          ]},
          { label: 'Dirección 2', level: 'Director', children: [] },
        ],
      },
      {
        label: 'Dir. Central B', level: 'Central',
        children: [
          { label: 'Dirección 3', level: 'Director', children: [
            { label: 'Jefatura 1', level: 'Jefe', children: [] },
          ]},
        ],
      },
    ],
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '8px 4px',
      overflow: 'hidden',
    }}>
      {/* Legend chips */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 4 }}>
        {Object.entries(LEVEL_COLORS).map(([lvl, c]) => (
          <span key={lvl} style={{
            background: c.bg,
            color: c.text,
            fontSize: 8,
            fontWeight: 700,
            borderRadius: 20,
            padding: '2px 7px',
            letterSpacing: 0.3,
          }}>{lvl}</span>
        ))}
      </div>

      {/* Mini tree */}
      <div style={{ transform: 'scale(0.92)', transformOrigin: 'top center' }}>
        <MiniNode {...tree} />
      </div>

      {/* Footer label */}
      <div style={{
        marginTop: 6,
        fontSize: 9,
        fontWeight: 600,
        color: '#9ca3af',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        13 unidades · 1,365 áreas
      </div>
    </div>
  );
}
