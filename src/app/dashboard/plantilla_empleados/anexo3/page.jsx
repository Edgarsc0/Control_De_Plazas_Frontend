import RequirePermission from "@/components/auth/RequirePermission";
import { PERMISSIONS } from "@/config/permissions";
import Anexo3TabContent from "./Anexo3TabContent";

export default function Anexo3Page() {
    return (
        <RequirePermission permission={PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES} redirectTo="/dashboard/plantilla_empleados">
            <Anexo3TabContent />
        </RequirePermission>
    );
}
