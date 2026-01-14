"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { LogOut } from "lucide-react"

export function UserNav({ email }: { email: string }) {
    const router = useRouter()
    const supabase = createClient()

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
            toast.error("Error al cerrar sesión")
        } else {
            toast.success("Sesión cerrada")
            router.refresh()
            router.push("/login")
        }
    }

    return (
        <Button
            className="w-full sm:w-auto bg-[#254153] hover:bg-[#1e3442] text-white"
            onClick={handleSignOut}
        >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
        </Button>
    )
}
