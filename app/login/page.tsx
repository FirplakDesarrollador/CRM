"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { recoverPasswordAction } from "./actions";
import { FirplakIsotipo } from "@/components/layout/FirplakLogo";

const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
});

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRecovering, setIsRecovering] = useState(false);
    const [recoverySent, setRecoverySent] = useState(false);

    // Initial Login Form
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
    });

    // Recovery Form
    const {
        register: registerRecovery,
        handleSubmit: handleSubmitRecovery,
        formState: { errors: errorsRecovery },
    } = useForm<{ email: string }>();

    // ... inside component

    const onRecoverySubmit = async (data: { email: string }) => {
        setIsLoading(true);
        setError(null);
        try {
            // Call Server Action
            const result = await recoverPasswordAction(data.email, window.location.origin);

            if (!result.success) {
                throw new Error(result.error);
            }

            setRecoverySent(true);
        } catch (err: any) {
            console.error("Recovery error:", err);
            setError(err.message || "Error al enviar correo de recuperación");
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (data: z.infer<typeof loginSchema>) => {
        setIsLoading(true);
        setError(null);
        console.log("Login: Attempting login for:", data.email);
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Tiempo de espera agotado al conectar con Supabase Auth")), 15000)
            );

            const supabasePromise = supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            // @ts-ignore
            const result = await Promise.race([supabasePromise, timeoutPromise]);
            const { data: authData, error: authError } = result as any;

            if (authError) {
                console.error("Login: Auth error:", authError.message);
                throw authError;
            }

            console.log("Login: Success! Session created for:", authData.user?.email);

            // Cache user ID for offline mode
            if (authData.user?.id) {
                localStorage.setItem('cachedUserId', authData.user.id);
            }

            router.push("/");
        } catch (err: any) {
            console.error("Login: Exception:", err);
            setError(err.message || "Error al iniciar sesión");
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 flex items-center justify-center p-3 md:p-4 relative overflow-hidden">
            {/* Subtle background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#254153]/10 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden grid md:grid-cols-2 relative z-10 border border-slate-200/50">
                {/* Left Panel - Branding (Desktop Only) */}
                <div className="hidden md:flex flex-col justify-between bg-linear-to-br from-[#254153] via-[#1e3844] to-[#152a35] p-8 lg:p-12 text-white relative overflow-hidden">
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0" style={{
                            backgroundImage: `radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)`,
                            backgroundSize: '48px 48px'
                        }}></div>
                    </div>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-[#152a35]/50 to-transparent"></div>

                    {/* Content */}
                    <div className="relative z-10">
                        <div className="mb-8 lg:mb-12">
                            <div className="w-16 lg:w-20 h-16 lg:h-20 bg-linear-to-br from-[#254153] to-[#1a2f3d] rounded-2xl lg:rounded-3xl flex items-center justify-center mb-6 lg:mb-8 border border-white/20 shadow-xl overflow-hidden p-3 lg:p-4 text-white">
                                <FirplakIsotipo className="w-full h-full" />
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-bold mb-3 lg:mb-4 tracking-tight leading-tight">CRM<br />FIRPLAK</h1>
                            <div className="w-12 lg:w-16 h-1 bg-linear-to-r from-blue-400 to-transparent rounded-full mb-3 lg:mb-4"></div>
                            <p className="text-base lg:text-lg text-blue-100/90 font-light leading-relaxed">Sistema de Gestión Comercial</p>
                        </div>

                        <div className="space-y-6 lg:space-y-8 mt-12 lg:mt-16">
                            <div className="flex items-start space-x-4 lg:space-x-5 group">
                                <div className="w-10 lg:w-12 h-10 lg:h-12 bg-white/10 backdrop-blur-md rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 border border-white/20 group-hover:bg-white/20 transition-all duration-300 shadow-lg">
                                    <svg className="w-5 lg:w-6 h-5 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-base lg:text-lg mb-1 lg:mb-2">Gestión Integral</h3>
                                    <p className="text-xs lg:text-sm text-blue-100/80 leading-relaxed">Administra cuentas, oportunidades y actividades comerciales desde una plataforma unificada</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4 lg:space-x-5 group">
                                <div className="w-10 lg:w-12 h-10 lg:h-12 bg-white/10 backdrop-blur-md rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 border border-white/20 group-hover:bg-white/20 transition-all duration-300 shadow-lg">
                                    <svg className="w-5 lg:w-6 h-5 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-base lg:text-lg mb-1 lg:mb-2">Modo Offline</h3>
                                    <p className="text-xs lg:text-sm text-blue-100/80 leading-relaxed">Trabaja sin conexión y sincroniza automáticamente cuando vuelvas a estar en línea</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4 lg:space-x-5 group">
                                <div className="w-10 lg:w-12 h-10 lg:h-12 bg-white/10 backdrop-blur-md rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 border border-white/20 group-hover:bg-white/20 transition-all duration-300 shadow-lg">
                                    <svg className="w-5 lg:w-6 h-5 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-base lg:text-lg mb-1 lg:mb-2">Seguridad Empresarial</h3>
                                    <p className="text-xs lg:text-sm text-blue-100/80 leading-relaxed">Protección de datos con autenticación robusta y encriptación de extremo a extremo</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 text-xs lg:text-sm text-blue-100/50 flex items-center justify-between">
                        <p>© 2026 Firplak</p>
                        <p className="text-xs">v1.0.7.8</p>
                    </div>
                </div>

                {/* Right Panel - Login Form */}
                <div className="p-6 sm:p-8 md:p-10 lg:p-14 flex flex-col justify-center bg-linear-to-br from-white to-slate-50/30">
                    {/* Mobile Branding Header */}
                    <div className="md:hidden mb-8 text-center">
                        <div className="w-16 h-16 bg-linear-to-br from-[#254153] to-[#1a2f3d] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl overflow-hidden p-3 text-white">
                            <FirplakIsotipo className="w-full h-full" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1 tracking-tight">CRM FIRPLAK</h1>
                        <p className="text-sm text-slate-600">Sistema de Gestión Comercial</p>
                    </div>

                    {isRecovering ? (
                        // Password Recovery View
                        <div className="space-y-6">
                            <div className="mb-8 md:mb-10">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-2 md:mb-3 tracking-tight">Recuperar Contraseña</h2>
                                <p className="text-sm md:text-base text-slate-600">Te enviaremos un enlace seguro para restablecer tu contraseña</p>
                            </div>

                            {recoverySent ? (
                                <div className="text-center space-y-4 md:space-y-6 bg-linear-to-br from-green-50 to-emerald-50/50 p-8 md:p-10 rounded-2xl md:rounded-3xl border border-green-200/50 shadow-lg">
                                    <div className="mx-auto w-16 md:w-20 h-16 md:h-20 bg-linear-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-xl">
                                        <Mail className="w-8 md:w-10 h-8 md:h-10 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-bold text-green-900 mb-2">¡Correo Enviado!</h3>
                                        <p className="text-sm md:text-base text-green-700 leading-relaxed">Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.</p>
                                    </div>
                                    <button
                                        onClick={() => { setIsRecovering(false); setRecoverySent(false); }}
                                        className="text-sm text-slate-600 hover:text-slate-900 font-semibold underline decoration-2 underline-offset-4 mt-4 md:mt-6 transition-colors"
                                    >
                                        Volver al inicio de sesión
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmitRecovery(onRecoverySubmit)} className="space-y-5 md:space-y-6">
                                    {error && (
                                        <div className="bg-linear-to-r from-red-50 to-rose-50 text-red-800 p-4 md:p-5 rounded-xl md:rounded-2xl text-sm border border-red-200/50 flex items-center shadow-sm">
                                            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                                            <span className="font-medium">{error}</span>
                                        </div>
                                    )}

                                    <div className="space-y-2 md:space-y-3">
                                        <label className="text-xs md:text-sm font-bold text-slate-800 block uppercase tracking-wide">Email Corporativo</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#254153] transition-colors" />
                                            <input
                                                {...registerRecovery("email", { required: "Email requerido" })}
                                                type="email"
                                                className="w-full pl-12 md:pl-14 pr-4 md:pr-5 py-3 md:py-4 border-2 border-slate-200 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#254153]/20 focus:border-[#254153] transition-all text-slate-900 placeholder:text-slate-400 bg-white shadow-sm hover:border-slate-300 text-sm md:text-base"
                                                placeholder="tu.email@firplak.com"
                                            />
                                        </div>
                                        {errorsRecovery.email && (
                                            <p className="text-red-600 text-xs md:text-sm mt-2 font-medium">{errorsRecovery.email.message}</p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-linear-to-r from-[#254153] to-[#1a2f3d] hover:from-[#1a2f3d] hover:to-[#254153] text-white font-bold py-3 md:py-4 rounded-xl md:rounded-2xl transition-all flex items-center justify-center shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : (
                                            "Enviar Enlace de Recuperación"
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIsRecovering(false)}
                                        className="w-full text-center text-sm text-slate-600 hover:text-slate-900 font-semibold py-2 md:py-3 transition-colors"
                                    >
                                        ← Volver al inicio de sesión
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        // Login View
                        <>
                            <div className="mb-8 md:mb-10">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-2 md:mb-3 tracking-tight">Bienvenido</h2>
                                <p className="text-sm md:text-base text-slate-600">Ingresa tus credenciales para acceder al sistema</p>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 md:space-y-6">
                                {error && (
                                    <div className="bg-linear-to-r from-red-50 to-rose-50 text-red-800 p-4 md:p-5 rounded-xl md:rounded-2xl text-sm border border-red-200/50 flex items-center shadow-sm">
                                        <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                                        <span className="font-medium">{error}</span>
                                    </div>
                                )}

                                <div className="space-y-2 md:space-y-3">
                                    <label className="text-xs md:text-sm font-bold text-slate-800 block uppercase tracking-wide">Email Corporativo</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#254153] transition-colors" />
                                        <input
                                            {...register("email")}
                                            type="email"
                                            className="w-full pl-12 md:pl-14 pr-4 md:pr-5 py-3 md:py-4 border-2 border-slate-200 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#254153]/20 focus:border-[#254153] transition-all text-slate-900 placeholder:text-slate-400 bg-white shadow-sm hover:border-slate-300 text-sm md:text-base"
                                            placeholder="tu.email@firplak.com"
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-red-600 text-xs md:text-sm mt-2 font-medium">{errors.email.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2 md:space-y-3">
                                    <label className="text-xs md:text-sm font-bold text-slate-800 block uppercase tracking-wide">Contraseña</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#254153] transition-colors" />
                                        <input
                                            {...register("password")}
                                            type="password"
                                            className="w-full pl-12 md:pl-14 pr-4 md:pr-5 py-3 md:py-4 border-2 border-slate-200 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#254153]/20 focus:border-[#254153] transition-all text-slate-900 bg-white shadow-sm hover:border-slate-300 text-sm md:text-base"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    {errors.password && (
                                        <p className="text-red-600 text-xs md:text-sm mt-2 font-medium">{errors.password.message}</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-linear-to-r from-[#254153] to-[#1a2f3d] hover:from-[#1a2f3d] hover:to-[#254153] text-white font-bold py-3 md:py-4 rounded-xl md:rounded-2xl transition-all flex items-center justify-center shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base mt-6 md:mt-8"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2 md:mr-3" />
                                            <span>Iniciando sesión...</span>
                                        </>
                                    ) : (
                                        "Iniciar Sesión"
                                    )}
                                </button>

                                <div className="text-center pt-4 md:pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsRecovering(true)}
                                        className="text-sm text-[#254153] hover:text-[#1a2f3d] font-semibold hover:underline decoration-2 underline-offset-4 transition-all"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            </form>

                            {/* Mobile Footer */}
                            <div className="md:hidden mt-8 pt-6 border-t border-slate-200 text-center">
                                <p className="text-xs text-slate-400 font-medium">© 2026 Firplak • v1.0.7.8</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function AlertCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    )
}
