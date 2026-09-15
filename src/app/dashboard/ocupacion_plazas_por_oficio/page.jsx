import OcupacionPlazasPorOficio from "./ClientComponent";
import RequirePermission from '@/components/auth/RequirePermission';
import { PERMISSIONS } from '@/config/permissions';

const OCUPACION_TAB_PERMISSIONS = [
    PERMISSIONS.VIEW_OCUPACION_SOLICITUDES,
    PERMISSIONS.EDIT_OCUPACION_PLAZAS,
];

export const metadata = { title: "Ocupación por Oficios" };

export default function ServerComponent() {
    return (
        <RequirePermission permission={OCUPACION_TAB_PERMISSIONS}>
            <OcupacionPlazasPorOficio />
        </RequirePermission>
    );
}
