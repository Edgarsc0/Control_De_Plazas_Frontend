import OcupacionPlazasPorOficio from "./ClientComponent";
import { OcupacionService } from "@/services/ocupacion.service";
import { cookies } from 'next/headers';
import RequirePermission from '@/components/auth/RequirePermission';
import { PERMISSIONS } from '@/config/permissions';

const OCUPACION_TAB_PERMISSIONS = [
    PERMISSIONS.VIEW_OCUPACION_SANKEY,
    PERMISSIONS.VIEW_OCUPACION_TABLA,
    PERMISSIONS.VIEW_OCUPACION_ESTADISTICAS,
    PERMISSIONS.EDIT_OCUPACION_PLAZAS,
];

export const dynamic = 'force-dynamic';

export const metadata = { title: "Ocupación por Oficios" };

export default async function ServerComponent() {
    // Obtenemos el token de las cookies para usarlo como llave de caché
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    let resumenOcupacion = { filas: [], columnas: [] };
    try {
        const responseOcupacion = await OcupacionService.getOcupacionPorOficios({
            headers: { 'Authorization': `Token ${token}` }
        });

        if (responseOcupacion.ok) {
            resumenOcupacion = await responseOcupacion.json();
        } else {
            console.error(`Error en la petición de ocupación: ${responseOcupacion.status}`);
        }
    } catch (error) {
        console.error("Error al obtener ocupación:", error);
    }

    return (
        <RequirePermission permission={OCUPACION_TAB_PERMISSIONS}>
            <OcupacionPlazasPorOficio resumenOcupacion={resumenOcupacion} />
        </RequirePermission>
    );
}
