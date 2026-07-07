const fs = require('fs');
const lines = fs.readFileSync('sap_metadata.xml', 'utf8').split('\n');

for (let i = 25452; i >= 0; i--) {
    if (lines[i].includes('<EntityType Name=')) {
        console.log('EntityType around line 25452:', lines[i].trim());
        break;
    }
}
