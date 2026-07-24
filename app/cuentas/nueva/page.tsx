import { Suspense } from "react";
import CreateAccountWizard from "./CreateAccountWizard";

export default function Page() {
    return (
        <Suspense fallback={<div className="p-6 text-center">Cargando...</div>}>
            <CreateAccountWizard />
        </Suspense>
    );
}
