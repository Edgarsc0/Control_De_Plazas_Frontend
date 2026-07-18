'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePageTabs } from '@/context/PageTabsContext';
import { resolveModuleByPath } from '@/config/modules';
import { PresenceService } from '@/services/presence.service';

const HEARTBEAT_INTERVAL_MS = 20000;
const TAB_ID_STORAGE_KEY = 'presence_tab_id';

// crypto.randomUUID() exige contexto seguro (https o localhost); el server
// se sirve por http:// plano sobre IP, así que no está disponible ahí.
function generateTabId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// sessionStorage (no localStorage) a propósito: cada pestaña/dispositivo debe
// tener su propio tab_id para que el panel de Roles > Usuarios los liste por
// separado, en vez de colapsar todas las pestañas del mismo usuario en una.
function getTabId() {
    let tabId = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (!tabId) {
        tabId = generateTabId();
        window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
    }
    return tabId;
}

/**
 * Manda un heartbeat de presencia (ruta + tab/subtab actuales) cada
 * HEARTBEAT_INTERVAL_MS y en cada cambio de ruta o de tab interno, para que
 * el panel de Roles > Usuarios muestre quién está activo y en qué página.
 * El backend lo guarda en Redis con TTL (no en BD): si el heartbeat deja de
 * llegar (pestaña cerrada, red caída) la sesión desaparece sola del panel,
 * sin necesitar ningún evento explícito de desconexión.
 */
export default function PresenceHeartbeat() {
    const { isAuthenticated } = useAuth();
    const pathname = usePathname();
    const { activeConfig } = usePageTabs();
    const tabIdRef = useRef(null);

    const activeSubtab = activeConfig?.tabs?.find((t) => t.id === activeConfig.activeTab);
    const subtabLabel = activeSubtab?.label || null;

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        if (!tabIdRef.current) tabIdRef.current = getTabId();

        const sendHeartbeat = () => {
            const moduleInfo = resolveModuleByPath(pathname);
            PresenceService.heartbeat({
                tab_id: tabIdRef.current,
                path: pathname,
                title: moduleInfo?.title || pathname,
                subtab: subtabLabel,
            }).catch(() => {});
        };

        sendHeartbeat();
        const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [isAuthenticated, pathname, subtabLabel]);

    return null;
}
