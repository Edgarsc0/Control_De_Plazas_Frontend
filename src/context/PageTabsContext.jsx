'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const PageTabsContext = createContext(null);

/**
 * Puente entre una página (que define sus tabs internos) y el BottomNav global.
 * La página registra su config con `useRegisterPageTabs`; el BottomNav la lee
 * con `usePageTabs` para abrir un Drawer con esos tabs desde el ítem activo.
 */
export function PageTabsProvider({ children }) {
  // activeConfig: { tabs:[{id,label}], activeTab, onSelect, title } | null
  const [activeConfig, setActiveConfig] = useState(null);

  return (
    <PageTabsContext.Provider value={{ activeConfig, setActiveConfig }}>
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
 * `tabs` y `onSelect` deben tener identidad estable (módulo / useCallback);
 * `activeTab` puede cambiar y re-registra para mover el check.
 */
export function useRegisterPageTabs({ tabs, activeTab, onSelect, title }) {
  const { setActiveConfig } = usePageTabs();

  useEffect(() => {
    setActiveConfig({ tabs, activeTab, onSelect, title });
    return () => setActiveConfig(null);
  }, [tabs, activeTab, onSelect, title, setActiveConfig]);
}
