import { notFound } from "next/navigation";
import CreateAccountWizard from "@/app/cuentas/nueva/CreateAccountWizard";

export default function E2ECreateAccountWizardPage() {
    if (process.env.NODE_ENV === "production") {
        notFound();
    }

    return <CreateAccountWizard />;
}
