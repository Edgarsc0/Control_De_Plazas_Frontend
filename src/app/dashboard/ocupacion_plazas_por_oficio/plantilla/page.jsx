import PlantillaEditor from "./PlantillaEditor";
import { PlantillaService } from "@/services/plantilla.service";
import RequirePermission from "@/components/auth/RequirePermission";
import { PERMISSIONS } from "@/config/permissions";

export const dynamic = 'force-dynamic';

export default async function PlantillaPage() {
    const response = await PlantillaService.getPlantilla1800();
    const data = await response.json();

    return (
        <RequirePermission permission={PERMISSIONS.EDIT_OCUPACION_PLAZAS} redirectTo="/dashboard/ocupacion_plazas_por_oficio">
            <div className="fixed inset-0 z-50 bg-white">
                <PlantillaEditor initialData={data} />
            </div>
        </RequirePermission>
    );
}
