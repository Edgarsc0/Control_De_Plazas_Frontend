export const metadata = {
  title: 'BD del SIG',
  description: 'Diagrama relacional del catálogo de tablas de PeopleSoft (Query Manager)',
};

import ClientComponent from './ClientComponent';
import RequirePermission from '@/components/auth/RequirePermission';
import { PERMISSIONS } from '@/config/permissions';

export default function BdSigPage() {
  return (
    <RequirePermission permission={PERMISSIONS.VIEW_MONITOREO_ZAFIRO}>
      <ClientComponent />
    </RequirePermission>
  );
}
