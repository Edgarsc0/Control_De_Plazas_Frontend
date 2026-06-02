import PlantillaEditor from "./PlantillaEditor";
import { PlantillaService } from "@/services/plantilla.service";

export const dynamic = 'force-dynamic';

export default async function PlantillaPage() {
    const response = await PlantillaService.getPlantilla1800();
    const data = await response.json();

    return (
        <div className="fixed inset-0 z-50 bg-white">
            <PlantillaEditor initialData={data} />
        </div>
    );
}
