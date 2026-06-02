import Link from 'next/link';

export default function Banner() {
    return (
        // Se agregaron las clases: fixed, top-0, left-0 y z-50
        <nav className="fixed top-0 left-0 w-full bg-[#621f32] h-20 flex items-center z-50 shadow-md">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex justify-between items-center">

                {/* Sección del Logo */}
                <Link href="/" className="flex items-center flex-shrink-0">
                    <img
                        src="https://framework-gb.cdn.gob.mx/gobmx/img/logo_blanco.svg"
                        alt="Logo Gobierno de México"
                        className="h-8 w-auto"
                    />
                </Link>

                {/* Enlaces de navegación y Búsqueda */}
                <div className="flex items-center gap-x-6 text-white text-[15px]">
                    <Link
                        href="/tramites"
                        className="hover:underline underline-offset-4 transition-all"
                    >
                        Trámites
                    </Link>
                    <Link
                        href="/gobierno"
                        className="hover:underline underline-offset-4 transition-all"
                    >
                        Gobierno
                    </Link>

                    {/* Icono de Lupa */}
                    <button
                        aria-label="Buscar"
                        className="text-white hover:text-gray-300 transition-colors ml-2"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="size-5 font-bold"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </button>
                </div>

            </div>
        </nav>
    );
}