import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserNav } from "@/features/auth/components/user-nav"

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
            <Card className="w-full max-w-md border-[#254153] border-2 shadow-lg">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold text-[#254153]">
                        Bienvenido al CRM Firplak
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-6 pt-4">
                    {/* We reuse UserNav but customize it or just keep it simple */}
                    <div className="text-center space-y-2">
                        <p className="text-muted-foreground text-sm">Has iniciado sesión como</p>
                        <p className="text-lg font-medium text-[#254153]">{user.email}</p>
                    </div>

                    <div className="pt-4 w-full flex justify-center">
                        <UserNav email={user.email || ""} />
                    </div>
                </CardContent>
            </Card>

            {/* Simple Footer Brand */}
            <div className="mt-8 text-sm font-medium text-[#254153] opacity-50">
                CRM Firplak &copy; {new Date().getFullYear()}
            </div>
        </div>
    )
}
