import { notFound } from "next/navigation";
import ActivityWizardHarness from "./ActivityWizardHarness";

export default function E2EActivitiesWizardPage() {
    if (process.env.NODE_ENV === "production") {
        notFound();
    }

    return <ActivityWizardHarness />;
}
