const fs = require('fs');
const http = require('http');

// Simple parser for .env
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        env[match[1]] = match[2].replace(/^["'](.+(?=["']$))["']$/, '$1');
    }
});

const supaUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || 'http://localhost:54321';
const supaKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

console.log("Using URL:", supaUrl);

const query = `
    query {
        __type(name: "CRM_Oportunidades") {
            fields {
                name
            }
        }
    }
`;

fetch(`${supaUrl}/graphql/v1`, {
    method: 'POST',
    headers: {
        'apikey': supaKey,
        'Authorization': `Bearer ${supaKey}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
}).then(r => r.json()).then(data => {
    if (data?.data?.__type?.fields) {
        const fields = data.data.__type.fields.map(f => f.name);
        console.log("CRM_Oportunidades valid fields:", fields.join(', '));
        fs.writeFileSync('tmp_opp_fields.txt', fields.join('\n'));
    } else {
        console.log("Could not find fields in response:", JSON.stringify(data).substring(0, 200));
    }
}).catch(e => console.error("Fetch error:", e));
