import { Metadata } from "next"

import { UserAuthForm } from "@/features/auth/components/user-auth-form"

export const metadata: Metadata = {
    title: "CRM Firplak - Login",
    description: "Accede a tu cuenta CRM",
}

export default function LoginPage() {
    return (
        <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            {/* Left Column: Branding (Blue) */}
            <div className="relative hidden h-full flex-col bg-[#254153] p-10 text-white dark:border-r lg:flex">
                <div className="relative z-20 flex items-center text-lg font-medium">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 h-6 w-6"
                    >
                        <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                    </svg>
                    CRM Firplak
                </div>
                <div className="relative z-20 mt-auto">
                    <blockquote className="space-y-2">
                        <p className="text-lg">
                            &ldquo;La herramienta definitiva para la gestión eficiente de tus clientes y procesos comerciales.&rdquo;
                        </p>
                        <footer className="text-sm opacity-80">Equipo de Desarrollo</footer>
                    </blockquote>
                </div>
            </div>

            {/* Right Column: Form (White) */}
            <div className="lg:p-8 bg-white h-full flex items-center justify-center">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-[#254153]">
                            Bienvenido
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Ingresa tus credenciales para continuar
                        </p>
                    </div>
                    <UserAuthForm />
                </div>
            </div>
        </div>
    )
}
