"use client";

import { useContacts } from "@/lib/hooks/useContacts";
import { ContactList } from "@/components/contactos/ContactList";

export default function AccountContactsTab({ accountId }: { accountId: string }) {
    return (
        <div className="pt-4">
            <ContactList accountId={accountId} />
        </div>
    );
}
