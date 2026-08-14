import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AuthService } from '@/services/auth.service';

const INPUT_CLASS =
    'block w-full rounded-md bg-white px-3 py-2 pr-10 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-[#621f32] sm:text-sm disabled:bg-gray-100';

/**
 * Cambio de contraseña.
 *
 * Se usa en dos situaciones:
 *  - `forzado`: la contraseña la puso un administrador (no hay correo
 *    institucional para mandar ligas de reseteo, así que alguien más la
 *    conoce) y el titular tiene que cambiarla antes de entrar. En ese caso el
 *    drawer no se puede cerrar y la contraseña actual ya viene resuelta desde
 *    el login, así que no se vuelve a pedir.
 *  - voluntario: el usuario la cambia desde dentro del sistema y sí debe
 *    escribir la actual.
 */
export default function CambiarPasswordDrawer({
    open,
    onOpenChange,
    passwordActual,
    forzado = false,
    onSuccess,
    setGlobalLoading,
    setGlobalLoadingText,
}) {
    const [actual, setActual] = useState('');
    const [nueva, setNueva] = useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [verPassword, setVerPassword] = useState(false);
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    const primerInput = useRef(null);

    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => primerInput.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, [open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (nueva !== confirmacion) {
            setError('La contraseña nueva y su confirmación no coinciden.');
            return;
        }

        const vigente = forzado ? passwordActual : actual;
        if (!vigente || !nueva) {
            setError('Completa todos los campos.');
            return;
        }

        setEnviando(true);
        setGlobalLoadingText?.('Actualizando contraseña...');
        setGlobalLoading?.(true);

        try {
            const response = await AuthService.changePassword(vigente, nueva);
            const data = await response.json();

            if (response.ok) {
                // El backend rota el token al cambiar la contraseña: si no se
                // persiste el nuevo, la sesión queda con uno ya invalidado.
                AuthService.saveToken(data.token);
                onSuccess?.();
            } else {
                setError(data.error || 'No se pudo actualizar la contraseña.');
                setGlobalLoading?.(false);
            }
        } catch {
            setError('Error de conexión con el servidor.');
            setGlobalLoading?.(false);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Drawer
            open={open}
            onOpenChange={forzado ? undefined : onOpenChange}
            dismissible={!forzado}
        >
            <DrawerContent
                className="bg-white/90 backdrop-blur-md"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onEscapeKeyDown={forzado ? (e) => e.preventDefault() : undefined}
                onPointerDownOutside={forzado ? (e) => e.preventDefault() : undefined}
            >
                <div className="mx-auto w-full max-w-md">
                    <DrawerHeader className="text-center">
                        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[#621f32]/10">
                            <KeyRound className="size-6 text-[#621f32]" />
                        </div>
                        <DrawerTitle className="text-2xl font-bold text-[#621f32]">
                            {forzado ? 'Define tu contraseña' : 'Cambiar contraseña'}
                        </DrawerTitle>
                        <DrawerDescription className="text-base">
                            {forzado
                                ? 'Tu contraseña actual fue asignada por un administrador. Define una nueva, personal, para continuar.'
                                : 'Al guardar se cerrarán las demás sesiones abiertas con la contraseña anterior.'}
                        </DrawerDescription>
                    </DrawerHeader>

                    <form onSubmit={handleSubmit} className="px-6 pb-2 space-y-4">
                        {!forzado && (
                            <div>
                                <label
                                    htmlFor="password-actual"
                                    className="block text-sm font-medium text-gray-900"
                                >
                                    Contraseña actual
                                </label>
                                <input
                                    id="password-actual"
                                    ref={primerInput}
                                    type="password"
                                    autoComplete="current-password"
                                    value={actual}
                                    onChange={(e) => setActual(e.target.value)}
                                    disabled={enviando}
                                    className={`mt-2 ${INPUT_CLASS}`}
                                />
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="password-nueva"
                                className="block text-sm font-medium text-gray-900"
                            >
                                Contraseña nueva
                            </label>
                            <div className="relative mt-2">
                                <input
                                    id="password-nueva"
                                    ref={forzado ? primerInput : undefined}
                                    type={verPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={nueva}
                                    onChange={(e) => setNueva(e.target.value)}
                                    disabled={enviando}
                                    className={INPUT_CLASS}
                                />
                                <button
                                    type="button"
                                    onClick={() => setVerPassword((v) => !v)}
                                    aria-label={
                                        verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                                    }
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-[#621f32]"
                                >
                                    {verPassword ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                Mínimo 8 caracteres. No puede ser solo números ni una contraseña
                                común.
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="password-confirmacion"
                                className="block text-sm font-medium text-gray-900"
                            >
                                Confirma la contraseña nueva
                            </label>
                            <input
                                id="password-confirmacion"
                                type={verPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={confirmacion}
                                onChange={(e) => setConfirmacion(e.target.value)}
                                disabled={enviando}
                                className={`mt-2 ${INPUT_CLASS}`}
                            />
                        </div>

                        {error && (
                            <div className="rounded-md border border-red-100 bg-red-50 p-2 text-center text-sm font-medium text-red-600">
                                {error}
                            </div>
                        )}

                        <DrawerFooter className="px-0 pb-8">
                            <Button
                                type="submit"
                                disabled={enviando}
                                className="h-12 w-full bg-[#621f32] text-base text-white hover:bg-[#4a1726] disabled:opacity-50"
                            >
                                {enviando ? 'Guardando...' : 'Guardar contraseña'}
                            </Button>
                            {!forzado && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onOpenChange?.(false)}
                                    disabled={enviando}
                                    className="w-full text-gray-500 hover:bg-[#621f32]/5 hover:text-[#621f32]"
                                >
                                    Cancelar
                                </Button>
                            )}
                        </DrawerFooter>
                    </form>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
