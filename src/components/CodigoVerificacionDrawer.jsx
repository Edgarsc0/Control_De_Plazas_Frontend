import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { useState, useRef, useEffect, useCallback } from "react"
import { AuthService } from "@/services/auth.service"


export default function CodigoVerificacionDrawer({
    open,
    onOpenChange,
    email,
    setGlobalLoading,
    setGlobalLoadingText,
    onCancel
}) {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState("");
    const inputs = useRef([]);

    const handleVerify = useCallback(async (codeToVerify) => {
        const code = codeToVerify || otp.join('');
        if (code.length < 6) return;

        setGlobalLoadingText("Verificando código...");
        setGlobalLoading(true);
        setError("");

        try {
            const response = await AuthService.verifyCode(email, code);
            const data = await response.json();

            if (response.ok) {
                AuthService.saveToken(data.token);
                window.location.href = "/dashboard";
            } else {
                setError(data.error || "Código incorrecto o expirado.");
                setGlobalLoading(false);
            }
        } catch (err) {
            setError("Error de conexión con el servidor.");
            setGlobalLoading(false);
        }
    }, [email, otp, setGlobalLoading, setGlobalLoadingText]);

    // Autofocus al abrir el drawer
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                if (inputs.current[0]) {
                    inputs.current[0].focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [open]);

    const handleCancelAction = () => {
        setOtp(['', '', '', '', '', '']);
        setError("");
        onCancel();
    };

    const handleChange = (element, index) => {
        if (isNaN(element.value)) return false;

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Focus next input
        if (element.value !== '' && index < 5) {
            inputs.current[index + 1].focus();
        }

        // Auto-submit si se llenaron todos
        const finalCode = newOtp.join('');
        if (finalCode.length === 6) {
            handleVerify(finalCode);
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    const handlePaste = (e) => {
        const data = e.clipboardData.getData("text").trim();
        if (data.length === 6 && !isNaN(data)) {
            const newOtp = data.split("");
            setOtp(newOtp);
            handleVerify(data);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-white/80 backdrop-blur-md" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="mx-auto w-full max-w-md">
                    <DrawerHeader className="text-center">
                        <DrawerTitle className="text-2xl font-bold text-[#621f32]">Código de Verificación</DrawerTitle>
                        <DrawerDescription className="text-base">
                            Hemos enviado un código de 6 dígitos a <span className="font-semibold">{email}</span>.
                            Ingrese los dígitos para continuar.
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-6 flex flex-col items-center">
                        <div className="flex gap-2 mb-4" onPaste={handlePaste}>
                            {otp.map((data, index) => (
                                // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                                <input
                                    key={index}
                                    type="text"
                                    maxLength="1"
                                    ref={(el) => (inputs.current[index] = el)}
                                    value={data}
                                    onChange={(e) => handleChange(e.target, index)}
                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                    className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg border-gray-300 focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32] outline-none transition-all bg-white text-gray-900 disabled:bg-gray-50"
                                />
                            ))}
                        </div>

                        {error && (
                            <p className="text-red-600 text-sm font-medium mb-4">{error}</p>
                        )}

                        <p className="text-sm text-gray-500 mb-4">
                            ¿No recibiste el código? <button className="text-[#621f32] font-semibold hover:underline">Reenviar</button>
                        </p>
                    </div>

                    <DrawerFooter className="pb-8">
                        <DrawerClose asChild>
                            <Button variant="ghost" onClick={handleCancelAction} className="w-full h-12 text-base text-gray-500 hover:text-[#621f32] hover:bg-[#621f32]/5 transition-colors">
                                Cancelar y volver
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
