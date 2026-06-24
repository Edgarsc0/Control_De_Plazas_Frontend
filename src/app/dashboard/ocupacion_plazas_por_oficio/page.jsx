import OcupacionPlazasPorOficio from "./ClientComponent";
import { OcupacionService } from "@/services/ocupacion.service";
import { cookies } from 'next/headers';

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
        <OcupacionPlazasPorOficio resumenOcupacion={resumenOcupacion} />
    );
}
