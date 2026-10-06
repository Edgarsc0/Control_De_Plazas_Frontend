'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ArrowDown, CheckCircle2, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/services/auth.service';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const RUTAS_LIBRES = ['/', '/login'];

function Seccion({ numero, titulo, children }) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-black text-[#621f32] uppercase tracking-wide">
                {numero}. {titulo}
            </h3>
            <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
        </section>
    );
}

/**
 * Aviso de confidencialidad y términos de uso. Se muestra al entrar al
 * sistema mientras el usuario no haya aceptado la versión vigente (ver
 * TERMINOS_VERSION y AceptarTerminosView en el backend, que guardan fecha,
 * versión e IP de la aceptación). Mientras tanto NO se monta el contenido
 * de la página: ningún dato se pide ni se pinta detrás del aviso.
 *
 * Flujo: leer hasta el final → "Acepto los términos y condiciones de uso" →
 * "Ingresar al sistema". Si el texto cambia de fondo, hay que subir
 * TERMINOS_VERSION para que todos lo acepten de nuevo.
 */
export default function TerminosGate({ children }) {
    const pathname = usePathname();
    const { isAuthenticated, isLoading, terminosAceptados, email, refresh, logout } = useAuth();
    const [leido, setLeido] = useState(false);
    const [acepto, setAcepto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState(null);
    const cuerpoRef = useRef(null);

    const pendiente = !isLoading && isAuthenticated && !terminosAceptados && !RUTAS_LIBRES.includes(pathname);

    const revisarScroll = useCallback(() => {
        const el = cuerpoRef.current;
        if (!el) return;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setLeido(true);
    }, []);

    // Pantallas muy altas donde el texto cabe completo: no hay nada que desplazar.
    useEffect(() => {
        if (pendiente) revisarScroll();
    }, [pendiente, revisarScroll]);

    useBodyScrollLock(pendiente);

    if (!pendiente) return children;

    const ingresar = async () => {
        setEnviando(true);
        setError(null);
        try {
            const response = await AuthService.aceptarTerminos();
            if (!response.ok) throw new Error();
            await refresh();
        } catch {
            setError('No se pudo registrar su aceptación. Verifique su conexión e inténtelo de nuevo.');
        } finally {
            setEnviando(false);
        }
    };

    if (typeof document === 'undefined') return null;

    // Capa fija a pantalla completa: la página no se desplaza; el único scroll
    // es el del texto, dentro de la tarjeta. Va en un portal a <body> porque
    // <main> es `relative z-10` y, dentro de él, ningún z-index alcanza a
    // tapar el Banner rojo (z-50) ni el Navbar.
    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 md:p-6 bg-slate-900/60">
            <div className="w-full max-w-3xl h-[min(88dvh,860px)] bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
                <header className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50/70">
                    <div className="p-2.5 bg-[#621f32] text-white rounded-xl shadow-md shrink-0">
                        <ShieldAlert className="size-6" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                            Aviso de confidencialidad y términos de uso
                        </h2>
                        <p className="text-xs font-semibold text-slate-500 truncate">
                            Sistema de Control de Plazas · Agencia Nacional de Aduanas de México
                        </p>
                    </div>
                </header>

                <div ref={cuerpoRef} onScroll={revisarScroll} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
                    <p className="text-sm leading-relaxed text-slate-700">
                        Antes de ingresar, lea con atención el presente aviso. El acceso al Sistema de Control de
                        Plazas (en adelante, «el Sistema») se otorga a la cuenta <strong>{email}</strong> en razón
                        del cargo que desempeña, y está condicionado a la aceptación íntegra de los términos
                        siguientes. Deberá leerlos hasta el final para poder aceptarlos.
                    </p>

                    <Seccion numero="1" titulo="Naturaleza de la información">
                        <p>
                            El Sistema contiene información de la Agencia Nacional de Aduanas de México y de las
                            personas servidoras públicas adscritas a ella, que incluye, de manera enunciativa y no
                            limitativa: datos de identificación (nombre, RFC, CURP, número de empleado y
                            fotografía), datos laborales (puesto, nivel, adscripción, percepciones, tipo de
                            contratación, estatus en nómina e historial de movimientos), datos de contacto,
                            domicilio y escolaridad, así como la estructura orgánica, la ocupación y la vacancia de
                            las plazas de la Agencia.
                        </p>
                        <p>
                            Esta información tiene <strong>carácter confidencial y, en su caso, reservado</strong>.
                            Parte de ella se refiere a personal que desempeña funciones operativas y de seguridad
                            en las aduanas del país, por lo que su divulgación puede poner en riesgo la integridad
                            de las personas y la operación institucional.
                        </p>
                    </Seccion>

                    <Seccion numero="2" titulo="Marco normativo">
                        <p>
                            El tratamiento de la información se sujeta a la normatividad aplicable en materia de
                            transparencia y acceso a la información pública, protección de datos personales en
                            posesión de sujetos obligados, responsabilidades administrativas de las personas
                            servidoras públicas y seguridad de la información, así como a las disposiciones
                            internas de la Agencia.
                        </p>
                    </Seccion>

                    <Seccion numero="3" titulo="Cuenta personal e intransferible">
                        <p>
                            Las credenciales de acceso se asignan a título personal. Usted es responsable de todas
                            las acciones realizadas con su cuenta.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>No comparta, preste ni transfiera su usuario o contraseña a ninguna persona, aun cuando pertenezca a su misma unidad o sea su superior jerárquico.</li>
                            <li>Si otra persona de su área requiere acceso, debe solicitarse por la vía oficial para que se le asigne una cuenta propia.</li>
                            <li>Sustituya la contraseña temporal en su primer ingreso y no la anote en lugares visibles ni la reutilice en otros servicios.</li>
                        </ul>
                    </Seccion>

                    <Seccion numero="4" titulo="Uso permitido">
                        <p>
                            La información solo podrá consultarse y utilizarse para el ejercicio de las funciones
                            institucionales propias de su cargo, dentro del alcance de datos que le fue asignado.
                            Que el Sistema le permita técnicamente ver un dato no lo autoriza a utilizarlo para
                            fines distintos.
                        </p>
                    </Seccion>

                    <Seccion numero="5" titulo="Conductas prohibidas">
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Difundir, reproducir, transmitir, publicar o entregar a terceros información del Sistema por cualquier medio físico o electrónico, incluidas redes sociales y aplicaciones de mensajería.</li>
                            <li>Fotografiar, grabar o capturar pantallas del Sistema para fines ajenos a sus funciones.</li>
                            <li>Utilizar la información para beneficio propio o de terceros, o para fines comerciales, políticos, personales o de cualquier índole no institucional.</li>
                            <li>Consultar información de personas o unidades sin que exista una necesidad derivada de sus funciones.</li>
                            <li>Intentar acceder a información, módulos o funciones para los que no tiene autorización, o eludir los controles de seguridad del Sistema.</li>
                            <li>Extraer información de forma masiva o automatizada por medios distintos a las funciones de exportación que el propio Sistema ofrece.</li>
                            <li>Alterar, falsear o eliminar información sin estar facultado para ello.</li>
                        </ul>
                    </Seccion>

                    <Seccion numero="6" titulo="Archivos descargados">
                        <p>
                            Los archivos que genere o descargue del Sistema (por ejemplo, en formato Excel, con o
                            sin fotografías y datos personales) conservan su carácter confidencial y quedan bajo
                            su estricta responsabilidad. Usted se obliga a:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Conservarlos únicamente en equipos y medios institucionales.</li>
                            <li>No enviarlos a cuentas de correo personales ni a servicios de mensajería o almacenamiento externos.</li>
                            <li>No imprimirlos ni reproducirlos más allá de lo estrictamente necesario, y resguardar las impresiones.</li>
                            <li>Eliminarlos de forma segura cuando dejen de ser necesarios para el fin que motivó su descarga.</li>
                        </ul>
                    </Seccion>

                    <Seccion numero="7" titulo="Seguridad de la sesión">
                        <ul className="list-disc pl-5 space-y-1">
                            <li>No deje su sesión abierta en equipos desatendidos y cierre la sesión al concluir su consulta.</li>
                            <li>Evite ingresar desde equipos públicos, de uso compartido o redes no confiables.</li>
                            <li>Evite que personas no autorizadas observen su pantalla mientras consulta información.</li>
                        </ul>
                    </Seccion>

                    <Seccion numero="8" titulo="Registro y auditoría de la actividad">
                        <p>
                            <strong>Toda la actividad realizada en el Sistema queda registrada y vinculada a su
                            cuenta</strong>: los inicios de sesión, las pantallas consultadas, el tiempo de uso, las
                            modificaciones realizadas y cada archivo generado o descargado, con su fecha y hora, el
                            contenido exportado, los filtros aplicados y la dirección desde la que se realizó.
                        </p>
                        <p>
                            Estos registros pueden ser consultados y auditados en cualquier momento por las
                            instancias competentes, y constituyen evidencia para deslindar responsabilidades. La
                            aceptación de este aviso también queda registrada con fecha, hora y dirección de origen.
                        </p>
                    </Seccion>

                    <Seccion numero="9" titulo="Aviso de incidentes">
                        <p>
                            Si sospecha que su contraseña ha sido comprometida, detecta un acceso o uso indebido de
                            su cuenta, extravía un equipo o archivo con información del Sistema, o advierte
                            cualquier vulneración a la confidencialidad, deberá notificarlo de inmediato al área
                            administradora del Sistema.
                        </p>
                    </Seccion>

                    <Seccion numero="10" titulo="Responsabilidades y sanciones">
                        <p>
                            El uso indebido de las credenciales o de la información —incluida su divulgación no
                            autorizada, su uso para fines distintos a los institucionales o el acceso de terceros
                            mediante su cuenta— será atribuido a la persona titular de la cuenta y podrá dar lugar a
                            las <strong>responsabilidades administrativas, y en su caso civiles o penales</strong>,
                            previstas en la legislación aplicable, con independencia de la revocación inmediata del
                            acceso.
                        </p>
                    </Seccion>

                    <Seccion numero="11" titulo="Vigencia del acceso">
                        <p>
                            El acceso se otorga mientras desempeñe el cargo que lo motivó. En caso de cambio de
                            adscripción, conclusión del encargo o separación del servicio, el acceso será revocado.
                            Las obligaciones de confidencialidad respecto de la información que haya conocido
                            <strong> subsisten aun después de concluido su acceso o su relación con la Agencia</strong>.
                        </p>
                    </Seccion>

                    <Seccion numero="12" titulo="Aceptación">
                        <p>
                            Al aceptar, usted manifiesta que ha leído y comprendido el presente aviso, que conoce
                            el carácter confidencial de la información y que se obliga a cumplir estos términos y
                            condiciones de uso durante todo el tiempo que conserve acceso al Sistema.
                        </p>
                    </Seccion>
                </div>

                <footer className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 space-y-3">
                    {!leido && (
                        <p className="flex items-center justify-center gap-2 text-xs font-bold text-amber-700">
                            <ArrowDown className="size-3.5" /> Desplácese hasta el final del aviso para poder aceptarlo
                        </p>
                    )}
                    {error && <p className="text-xs font-semibold text-red-600 text-center">{error}</p>}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={logout}
                            disabled={enviando}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                        >
                            <LogOut className="size-4" /> No acepto, cerrar sesión
                        </button>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={() => setAcepto(true)}
                                disabled={!leido || acepto}
                                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer disabled:cursor-not-allowed ${
                                    acepto
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-[#621f32]/40 text-[#621f32] hover:bg-[#621f32]/5 disabled:opacity-40'
                                }`}
                            >
                                <CheckCircle2 className="size-4" />
                                {acepto ? 'Términos y condiciones aceptados' : 'Acepto los términos y condiciones de uso'}
                            </button>
                            <button
                                type="button"
                                onClick={ingresar}
                                disabled={!acepto || enviando}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#621f32] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#4d1827] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {enviando && <Loader2 className="size-4 animate-spin" />}
                                Ingresar al sistema
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
        , document.body
    );
}
