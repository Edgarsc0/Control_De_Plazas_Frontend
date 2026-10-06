'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePageTabs } from '@/context/PageTabsContext';
import { resolveModuleByPath } from '@/config/modules';
import { instalarAuditoriaExcel, suscribirSolicitudes } from '@/lib/excelAudit';
import ExportConFotosModal from '@/app/dashboard/plantilla_empleados/_components/shared/ExportConFotosModal';

/**
 * Anfitrión de la auditoría de Excel (ver lib/excelAudit.js): instala el
 * interceptor de descargas con la pantalla actual ("Página › Tab › Subtab",
 * mismo criterio que PresenceHeartbeat) y muestra el aviso de
 * confidencialidad que piden los botones de Excel.
 */
export default function ExcelAuditHost() {
    const pathname = usePathname();
    const { activeConfig } = usePageTabs();
    const contextoRef = useRef('');
    const [solicitud, setSolicitud] = useState(null);

    const tab = activeConfig?.tabs?.find((t) => t.id === activeConfig.activeTab);
    const grupoSubtabs = activeConfig?.subtabConfigs?.[activeConfig?.activeTab];
    const subtab = grupoSubtabs?.options?.find((o) => o.id === grupoSubtabs.active)?.label;
    contextoRef.current = [resolveModuleByPath(pathname)?.title || pathname, tab?.label, subtab]
        .filter(Boolean)
        .join(' › ');

    useEffect(() => {
        instalarAuditoriaExcel(() => contextoRef.current);
        return suscribirSolicitudes(setSolicitud);
    }, []);

    return (
        <ExportConFotosModal
            open={!!solicitud}
            onClose={() => solicitud?.resolver(false)}
            onConfirm={() => solicitud?.resolver(true)}
            isExporting={false}
            rowCount={0}
            canIncluirFotos={false}
            showDatosPersonalesOption={false}
        />
    );
}
