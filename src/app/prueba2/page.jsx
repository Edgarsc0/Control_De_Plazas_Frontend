import ClientComponent from "./ClientComponent";

export const metadata = {
  title: "Prueba 3D Torre Caballito",
};

export default function Prueba2Page() {
  return (
    <div className="h-[calc(100vh-144px)] w-full relative bg-transparent overflow-hidden">
      <div className="absolute inset-0">
        <ClientComponent />
      </div>
    </div>
  );
}
