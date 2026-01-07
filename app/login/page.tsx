"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { recoverPasswordAction } from "./actions";

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
            router.push("/");
        } catch (err: any) {
            console.error("Login: Exception:", err);
            setError(err.message || "Error al iniciar sesión");
        } finally {
            setIsLoading(false);
        }
    };

    const handleMicrosoftLogin = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'azure',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    scopes: 'email openid profile offline_access user.read'
                }
            });
            if (error) throw error;
        } catch (error: any) {
            setError(error.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-linear-to-r from-blue-600 to-cyan-500 p-8 text-center text-white">
                    <h1 className="text-3xl font-bold mb-2">CRM FIRPLAK</h1>
                    <p className="opacity-90">Acceso a Vendedores</p>
                </div>

                <div className="p-8">
                    {/* Password Recovery View */}
                    {isRecovering ? (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="font-bold text-slate-800">Recuperar Contraseña</h3>
                                <p className="text-sm text-slate-500">Te enviaremos un enlace para restablecerla.</p>
                            </div>

                            {recoverySent ? (
                                <div className="text-center space-y-4 bg-green-50 p-6 rounded-xl border border-green-100">
                                    <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                        <Mail className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-green-800">¡Correo Enviado!</h3>
                                        <p className="text-xs text-green-700 mt-1">Revisa tu bandeja de entrada y sigue las instrucciones.</p>
                                    </div>
                                    <button
                                        onClick={() => { setIsRecovering(false); setRecoverySent(false); }}
                                        className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
                                    >
                                        Volver al inicio
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmitRecovery(onRecoverySubmit)} className="space-y-6">
                                    {error && (
                                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-center">
                                            <AlertCircle className="w-4 h-4 mr-2" />
                                            {error}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Email Corporativo</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                            <input
                                                {...registerRecovery("email", { required: "Email requerido" })}
                                                type="email"
                                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                placeholder="usuario@firplak.com"
                                            />
                                        </div>
                                        {errorsRecovery.email && (
                                            <p className="text-red-500 text-xs">{errorsRecovery.email.message}</p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : (
                                            "Enviar Enlace"
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIsRecovering(false)}
                                        className="w-full text-center text-sm text-slate-500 hover:text-slate-700 font-medium"
                                    >
                                        Cancelar y volver
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        // Login View (Fragments allow adjacent JSX elements)
                        <>
                            {/* Microsoft Login Button */}
                            <div className="mb-6">
                                <button
                                    type="button"
                                    onClick={handleMicrosoftLogin}
                                    disabled={isLoading}
                                    className="w-full flex justify-center items-center gap-3 px-4 py-3 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                    ) : (
                                        <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                                            <path fill="#f35325" d="M1 1h10v10H1z" />
                                            <path fill="#81bc06" d="M12 1h10v10H1z" />
                                            <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                            <path fill="#ffba08" d="M12 12h10v10H1z" />
                                        </svg>
                                    )}
                                    <span>Continuar con Microsoft</span>
                                </button>
                            </div>

                            <div className="relative mb-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-slate-500">O ingresa con Email</span>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {error && (
                                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-2" />
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Email Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <input
                                            {...register("email")}
                                            type="email"
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            placeholder="usuario@firplak.com"
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-red-500 text-xs">{errors.email.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <input
                                            {...register("password")}
                                            type="password"
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    {errors.password && (
                                        <p className="text-red-500 text-xs">{errors.password.message}</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    ) : (
                                        "Ingresar"
                                    )}
                                </button>
                            </form>

                            <p className="mt-8 text-center text-xs text-slate-400">
                                <button
                                    type="button"
                                    onClick={() => setIsRecovering(true)}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </p>
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
