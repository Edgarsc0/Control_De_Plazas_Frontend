'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PageTabsContext = createContext(null);

/**
 * Puente entre una página (que define sus tabs internos) y el BottomNav global.
 * La página registra su config con `useRegisterPageTabs`; el BottomNav la lee
 * con `usePageTabs` para abrir un Drawer con esos tabs desde el ítem activo.
 */
export function PageTabsProvider({ children }) {
  // activeConfig: { tabs:[{id,label}], activeTab, onSelect, title } | null
  const [activeConfig, setActiveConfig] = useState(null);
  // Señal para abrir el Drawer de secciones desde fuera del BottomNav (la
  // página necesita ofrecer un acceso visible: nada en pantalla indicaba que
  // los tabs vivían en la barra inferior).
  const [openSignal, setOpenSignal] = useState(0);
  const openPageTabs = useCallback(() => setOpenSignal((n) => n + 1), []);

  return (
    <PageTabsContext.Provider value={{ activeConfig, setActiveConfig, openSignal, openPageTabs }}>
      {children}
    </PageTabsContext.Provider>
  );
}

export function usePageTabs() {
  const ctx = useContext(PageTabsContext);
  if (!ctx) {
    throw new Error('usePageTabs debe usarse dentro de PageTabsProvider');
  }
  return ctx;
}

/**
 * La página llama esto para publicar sus tabs al BottomNav mientras está montada.
 * `tabs`, `onSelect` y `subtabConfigs` deben tener identidad estable (módulo /
 * useCallback / useMemo); `activeTab` puede cambiar y re-registra para mover el check.
 */
export function useRegisterPageTabs({ tabs, activeTab, onSelect, title, subtabConfigs }) {
  const { setActiveConfig } = usePageTabs();

  useEffect(() => {
    setActiveConfig({ tabs, activeTab, onSelect, title, subtabConfigs });
    return () => setActiveConfig(null);
  }, [tabs, activeTab, onSelect, title, subtabConfigs, setActiveConfig]);
}
