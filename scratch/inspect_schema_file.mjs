import fs from 'fs';

function readTextFileSafe(filename) {
    const buffer = fs.readFileSync(filename);
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return buffer.toString('utf16le');
    }
    return buffer.toString('utf8');
}

let content = readTextFileSafe('schema.json').replace(/^\uFEFF/, '');
let schema = JSON.parse(content);
if (typeof schema === 'string') {
    schema = JSON.parse(schema);
}

console.log("Parsed keys:", Object.keys(schema));
console.log("Paths keys:", Object.keys(schema.paths || {}).slice(0, 15));
console.log("Definitions keys:", Object.keys(schema.definitions || {}).slice(0, 15));

function inspectDefinition(name) {
    console.log(`\n=== Definition: ${name} ===`);
    if (schema.definitions && schema.definitions[name]) {
        console.log(JSON.stringify(schema.definitions[name], null, 2));
    } else {
        console.log("Not found.");
    }
}

inspectDefinition('purchase_orders');
inspectDefinition('oficios');
inspectDefinition('service_requests');
