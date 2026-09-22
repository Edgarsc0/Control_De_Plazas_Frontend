import Link from 'next/link';

export default function Banner() {
    return (
        // Oculto en móvil a propósito: en esa vista solo se muestra el header
        // blanco con el logo de ADUANAS (Navbar), sin la barra gob.mx.
        //
        // Una sola fila: logo | leyenda (centro, flex-1, envuelve líneas) |
        // enlaces. La leyenda va EN MEDIO, no en una fila propia debajo —
        // logo y enlaces quedan con `shrink-0` en los extremos para que el
        // texto central tenga todo el ancho restante y no se recorte.
        // `h-20` da alto para que la leyenda envuelva 2 líneas dentro de
        // la misma fila sin desbordar. Este alto alimenta
        // `--banner-h`/`--stack-h` en globals.css.
        <nav className="fixed top-0 left-0 w-full bg-[#621f32] h-20 hidden md:flex items-center z-50 shadow-md">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex items-center gap-8">

                {/* Sección del Logo */}
                <Link href="/" className="flex items-center shrink-0">
                    <img
                        src="https://framework-gb.cdn.gob.mx/gobmx/img/logo_blanco.svg"
                        alt="Logo Gobierno de México"
                        className="h-6 w-auto"
                    />
                </Link>

                {/* Aviso de confidencialidad — en medio, completo, sin
                    line-clamp; envuelve tantas líneas como necesite. */}
                <p className="flex-1 min-w-0 text-white/70 text-[11px] leading-snug text-justify">
                    La información de este sistema es <strong className="font-bold text-white">estrictamente confidencial</strong>. Toda actividad o intento de manipulación en la plataforma <strong className="font-bold text-white">queda registrado para auditoría y supervisión</strong>. Queda <strong className="font-bold text-white">prohibida la distribución o el uso no autorizado</strong> de estos datos; cualquier infracción será sujeta a las <strong className="font-bold text-white">sanciones administrativas correspondientes</strong>.
                </p>

                {/* Enlaces de navegación y Búsqueda */}
                <div className="flex items-center gap-x-6 text-white text-[13px] shrink-0">
                    <Link
                        href="/tramites"
                        className="hover:underline underline-offset-4 transition-all whitespace-nowrap"
                    >
                        Trámites
                    </Link>
                    <Link
                        href="/gobierno"
                        className="hover:underline underline-offset-4 transition-all whitespace-nowrap"
                    >
                        Gobierno
                    </Link>

                    {/* Icono de Lupa */}
                    <button
                        aria-label="Buscar"
                        className="text-white hover:text-gray-300 transition-colors ml-2 shrink-0"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="size-4 font-bold"
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
