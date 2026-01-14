import { Suspense } from "react";
import CreateOpportunityWizard from "./CreateOpportunityWizard";

export default function Page() {
    return (
        <Suspense fallback={<div className="p-6 text-center">Cargando...</div>}>
            <CreateOpportunityWizard />
        </Suspense>
    );
}
