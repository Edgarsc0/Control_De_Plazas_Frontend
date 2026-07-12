export const metadata = {
  title: 'Monitoreo ZAFIRO',
  description: 'Bitácora de actualizaciones del sistema ZAFIRO',
};

import ClientComponent from './ClientComponent';
import RequirePermission from '@/components/auth/RequirePermission';
import { PERMISSIONS } from '@/config/permissions';

export default function MonitoreoZafiroPage() {
  return (
    <RequirePermission permission={PERMISSIONS.VIEW_MONITOREO_ZAFIRO}>
      <ClientComponent />
    </RequirePermission>
  );
}
