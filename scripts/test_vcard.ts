
import { parseVCard } from '../lib/vcard';

const vcard1 = `BEGIN:VCARD
VERSION:3.0
FN:Forrest Gump
N:Gump;Forrest;;Mr.;
ORG:Bubba Gump Shrimp Co.
TITLE:Shrimp Man
TEL;TYPE=WORK,VOICE:(111) 555-1212
TEL;TYPE=HOME,VOICE:(404) 555-1212
EMAIL;TYPE=PREF,INTERNET:forrestgump@example.com
REV:2008-04-24T19:52:43Z
END:VCARD`;

const vcard2 = `BEGIN:VCARD
VERSION:3.0
N:Doe;John;;;
FN:John Doe
TEL;TYPE=CELL:1234567890
EMAIL:john@example.com
END:VCARD`;

const vcard3 = `BEGIN:VCARD
VERSION:3.0
FN:Simple Name Only
END:VCARD`;

function test() {
    console.log("Testing vCard 1...");
    const contact1 = parseVCard(vcard1);
    console.log(contact1);
    if (contact1.name !== "Forrest Gump") console.error("FAIL: Name mismatch");
    if (contact1.tel !== "(111) 555-1212") console.error("FAIL: Tel mismatch"); // First one
    if (contact1.email !== "forrestgump@example.com") console.error("FAIL: Email mismatch");
    if (contact1.org !== "Bubba Gump Shrimp Co.") console.error("FAIL: Org mismatch");
    if (contact1.title !== "Shrimp Man") console.error("FAIL: Title mismatch");

    console.log("\nTesting vCard 2...");
    const contact2 = parseVCard(vcard2);
    console.log(contact2);
    if (contact2.name !== "John Doe") console.error("FAIL: Name mismatch");
    if (contact2.firstName !== "John") console.error("FAIL: FirstName mismatch");
    if (contact2.lastName !== "Doe") console.error("FAIL: LastName mismatch");
    if (contact2.tel !== "1234567890") console.error("FAIL: Tel mismatch");

    console.log("\nTesting vCard 3...");
    const contact3 = parseVCard(vcard3);
    console.log(contact3);
    if (contact3.name !== "Simple Name Only") console.error("FAIL: Name mismatch");

    console.log("\nDone.");
}

test();
