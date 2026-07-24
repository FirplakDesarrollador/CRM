const fs = require('fs');
const xml = fs.readFileSync('sap_metadata.xml', 'utf8');

const regex = /<EntityType Name="([^"]+)"[\s\S]*?<Property Name="U_Territorio"/g;
let match;
while ((match = regex.exec(xml)) !== null) {
    // The regex is too greedy and will just match the very first EntityType up to the U_Territorio.
    // Instead, split by EntityType.
}

const entities = xml.split('<EntityType Name="');
for (let i = 1; i < entities.length; i++) {
    const entity = entities[i];
    const name = entity.substring(0, entity.indexOf('"'));
    if (entity.includes('<Property Name="U_Territorio"')) {
        console.log('U_Territorio is in EntityType:', name);
    }
}
