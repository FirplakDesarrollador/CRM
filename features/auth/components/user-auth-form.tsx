"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> { }

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState<boolean>(false)

    async function onSubmit(event: React.SyntheticEvent) {
        event.preventDefault()
        setIsLoading(true)

        const target = event.target as typeof event.target & {
            email: { value: string }
            password: { value: string }
        }

        const email = target.email.value
        const password = target.password.value

        if (!email || !password) {
            toast.error("Datos incompletos", {
                description: "Por favor ingresa tu email y contraseña."
            })
            setIsLoading(false)
            return
        }

        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            toast.error("Error de inicio de sesión", {
                description: "Contraseña incorrecta o usuario no encontrado."
            })
            setIsLoading(false)
            return
        }

        toast.success("Bienvenido", {
            description: "Has iniciado sesión correctamente."
        })

        router.push("/")
        router.refresh()
    }

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            <form onSubmit={onSubmit}>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-foreground font-semibold">
                            Email
                        </Label>
                        <Input
                            id="email"
                            placeholder="nombre@ejemplo.com"
                            type="email"
                            autoCapitalize="none"
                            autoComplete="email"
                            autoCorrect="off"
                            disabled={isLoading}
                            className="border-2 border-primary focus-visible:ring-primary"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password" className="text-foreground font-semibold">
                            Contraseña
                        </Label>
                        <Input
                            id="password"
                            placeholder="••••••••"
                            type="password"
                            autoCapitalize="none"
                            autoCorrect="off"
                            disabled={isLoading}
                            className="border-2 border-primary focus-visible:ring-primary"
                        />
                    </div>
                    <Button disabled={isLoading} className="mt-2 w-full bg-primary text-white hover:bg-primary/90">
                        {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Iniciar Sesión
                    </Button>
                </div>
            </form>
        </div>
    )
}
