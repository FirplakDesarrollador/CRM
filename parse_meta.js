const fs = require('fs');

const xml = fs.readFileSync('sap_metadata.xml', 'utf8');

// Find EntityType Name="BusinessPartner"
const startIdx = xml.indexOf('<EntityType Name="BusinessPartner"');
const endIdx = xml.indexOf('</EntityType>', startIdx);

const bpXml = xml.substring(startIdx, endIdx);

const matches = bpXml.match(/<Property Name="U_[^"]+"/g);
if (matches) {
    console.log(matches.join('\n'));
} else {
    console.log('No UDFs found for BusinessPartner');
}
