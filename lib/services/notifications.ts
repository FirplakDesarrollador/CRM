import { supabase } from '@/lib/supabase';
import { LocalOportunidad, db } from '@/lib/db';

const POWER_AUTOMATE_URL = process.env.NEXT_PUBLIC_POWER_AUTOMATE_DELETION_URL;

export async function sendOpportunityDeletionEmail(opportunity: LocalOportunidad) {
    if (!POWER_AUTOMATE_URL) {
        console.warn('[NotificationService] Power Automate URL not configured');
        return;
    }

    try {
        // 1. Fetch Owner Email
        let ownerEmail = '';
        if (opportunity.owner_user_id) {
            const { data: userData } = await supabase
                .from('CRM_Usuarios')
                .select('email, full_name')
                .eq('id', opportunity.owner_user_id)
                .single();
            
            if (userData) {
                ownerEmail = userData.email;
            }
        }

        if (!ownerEmail) {
            console.warn('[NotificationService] No owner email found for opportunity:', opportunity.id);
            // Fallback to current user if owner not found?
            // For now, let's just proceed if we have at least one recipient
        }

        // 2. Fetch Collaborators and their emails
        const collaborators = await db.opportunityCollaborators
            .where('oportunidad_id')
            .equals(opportunity.id)
            .toArray();

        const collaboratorEmails: string[] = [];
        if (collaborators.length > 0) {
            const userIds = collaborators.map(c => c.usuario_id);
            const { data: colData } = await supabase
                .from('CRM_Usuarios')
                .select('email')
                .in('id', userIds);
            
            if (colData) {
                collaboratorEmails.push(...colData.map(u => u.email));
            }
        }

        // Combine recipients (removing duplicates)
        const recipients = Array.from(new Set([ownerEmail, ...collaboratorEmails])).filter(e => !!e);

        if (recipients.length === 0) {
            console.warn('[NotificationService] No recipients found for deletion notification');
            return;
        }

        // 3. Construct Message
        const titulo = `Oportunidad Eliminada: ${opportunity.nombre}`;
        const mensaje = `La oportunidad "${opportunity.nombre}" ha sido eliminada del CRM.\n\n` +
                        `Detalles:\n` +
                        `- ID: ${opportunity.id}\n` +
                        `- Valor: ${opportunity.amount || opportunity.valor} ${opportunity.currency_id || 'COP'}\n` +
                        `- Fecha de eliminación: ${new Date().toLocaleString()}\n\n` +
                        `Este es un mensaje automático.`;

        // 4. Send to Power Automate (One call per recipient as per schema)
        // Note: The schema provided by the user has a single 'correo_usuario' field.
        const sendPromises = recipients.map(email => 
            fetch(POWER_AUTOMATE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    correo_usuario: email,
                    titulo_mensaje: titulo,
                    mensaje: mensaje
                })
            })
        );

        const results = await Promise.allSettled(sendPromises);
        
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`[NotificationService] Failed to send email to ${recipients[index]}:`, result.reason);
            } else if (!result.value.ok) {
                console.error(`[NotificationService] Power Automate error for ${recipients[index]}:`, result.value.statusText);
            }
        });

        console.log(`[NotificationService] Deletion notifications sent to ${recipients.length} recipients.`);

    } catch (error) {
        console.error('[NotificationService] Unexpected error sending deletion notification:', error);
    }
}
