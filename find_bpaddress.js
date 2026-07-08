const fs = require('fs');
const lines = fs.readFileSync('sap_metadata.xml','utf8').split('\n');
let inBPAddress = false;
for (let l of lines) {
    if (l.includes('<ComplexType Name="BPAddress"')) {
        inBPAddress = true;
    }
    if (inBPAddress) {
        if (l.includes('<Property Name=')) {
            console.log(l.trim());
        }
        if (l.includes('</ComplexType>')) {
            break;
        }
    }
}
