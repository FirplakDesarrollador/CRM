import { notFound } from "next/navigation";
import ActivityChecklistHarness from "./ActivityChecklistHarness";

export default function E2EActivitiesChecklistPage() {
    if (process.env.NODE_ENV === "production") {
        notFound();
    }

    return <ActivityChecklistHarness />;
}
