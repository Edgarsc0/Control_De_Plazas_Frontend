import PlantillaEmpleadosDetalle from "./ClientComponent"
import { VacantesService } from "@/services/vacantes.service";

export const dynamic = 'force-dynamic';

export default async function PlantillaEmpleadosPage() {
    const [
        responseResumen,
        responseDetalle,
        responseEstatus,
        responseGeografica,
        responseMovPos,
        responseBajas,
        responseMotivos,
        responseHistorico,
        responseCuadros,
        responseDesglose
    ] = await Promise.all([
        VacantesService.getEmpleadosCompletosEstatusResumen(),
        VacantesService.getEmpleadosCompletosActivosDetalle(),
        VacantesService.getEmpleadosEstatusPorNivelUa().catch(err => {
            console.error("Error fetching estatus por nivel y UA:", err);
            return null;
        }),
        VacantesService.getEmpleadosDistribucionGeografica().catch(err => {
            console.error("Error fetching distribución geográfica:", err);
            return null;
        }),
        VacantesService.getMovPosDetalle().catch(err => {
            console.error("Error fetching mov pos detalle:", err);
            return null;
        }),
        VacantesService.getBajasSig().catch(err => {
            console.error("Error fetching bajas:", err);
            return null;
        }),
        VacantesService.getBajasMotivos().catch(err => {
            console.error("Error fetching bajas motivos:", err);
            return null;
        }),
        VacantesService.getBajasHistorico().catch(err => {
            console.error("Error fetching bajas historico:", err);
            return null;
        }),
        VacantesService.getCuadroVacancia().catch(err => {
            console.error("Error fetching cuadro vacancia:", err);
            return null;
        }),
        VacantesService.getDesgloseJerarquico().catch(err => {
            console.error("Error fetching desglose jerarquico:", err);
            return null;
        })
    ]);

    let resumen = null;
    if (responseResumen && responseResumen.ok) {
        try {
            resumen = await responseResumen.json();
        } catch (e) {
            console.error("Error parsing resumen JSON:", e);
        }
    }

    let detalle = [];
    if (responseDetalle && responseDetalle.ok) {
        try {
            detalle = await responseDetalle.json();
        } catch (e) {
            console.error("Error parsing detalle JSON:", e);
        }
    }
    
    let estatusPorNivelUa = { por_nivel: {}, por_ua: {} };
    if (responseEstatus && responseEstatus.ok) {
        try {
            estatusPorNivelUa = await responseEstatus.json();
        } catch (e) {
            console.error("Error parsing estatus por nivel y UA JSON:", e);
        }
    }

    let distribucionGeografica = [];
    if (responseGeografica && responseGeografica.ok) {
        try {
            distribucionGeografica = await responseGeografica.json();
        } catch (e) {
            console.error("Error parsing distribución geográfica JSON:", e);
        }
    }

    let movPosData = [];
    if (responseMovPos && responseMovPos.ok) {
        try {
            movPosData = await responseMovPos.json();
        } catch (e) {
            console.error("Error parsing mov pos detalle JSON:", e);
        }
    }

    let bajasData = [];
    if (responseBajas && responseBajas.ok) {
        try {
            bajasData = await responseBajas.json();
        } catch (e) {
            console.error("Error parsing bajas JSON:", e);
        }
    }

    let bajasMotivos = [];
    if (responseMotivos && responseMotivos.ok) {
        try {
            bajasMotivos = await responseMotivos.json();
        } catch (e) {
            console.error("Error parsing bajas motivos JSON:", e);
        }
    }

    let bajasHistorico = [];
    if (responseHistorico && responseHistorico.ok) {
        try {
            bajasHistorico = await responseHistorico.json();
        } catch (e) {
            console.error("Error parsing bajas historico JSON:", e);
        }
    }

    let cuadrosData = [];
    if (responseCuadros && responseCuadros.ok) {
        try {
            cuadrosData = await responseCuadros.json();
        } catch (e) {
            console.error("Error parsing cuadros JSON:", e);
        }
    }

    let desgloseJerarquicoData = [];
    if (responseDesglose && responseDesglose.ok) {
        try {
            desgloseJerarquicoData = await responseDesglose.json();
        } catch (e) {
            console.error("Error parsing desglose jerarquico JSON:", e);
        }
    }

    return (
        <PlantillaEmpleadosDetalle 
            resumen={resumen} 
            detalle={detalle} 
            estatusPorNivelUa={estatusPorNivelUa} 
            distribucionGeografica={distribucionGeografica}
            movPosData={movPosData}
            bajasData={bajasData}
            bajasMotivos={bajasMotivos}
            bajasHistorico={bajasHistorico}
            cuadrosData={cuadrosData}
            desgloseJerarquicoData={desgloseJerarquicoData}
        />
    );
}
