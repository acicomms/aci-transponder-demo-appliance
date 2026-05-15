const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./nms_database.db');

const fakeNodes = [
    { eui: 'fake000000000001', lat: 47.6062, lng: -122.3321, name: 'Seattle Node' },
    { eui: 'fake000000000002', lat: 47.2529, lng: -122.4443, name: 'Tacoma LE' },
    { eui: 'fake000000000003', lat: 47.6101, lng: -122.2015, name: 'Bellevue Amp' },
    { eui: 'fake000000000004', lat: 47.9790, lng: -122.2021, name: 'Everett Node' },
    { eui: 'fake000000000005', lat: 47.4829, lng: -122.2171, name: 'Renton LE' },
    { eui: 'fake000000000006', lat: 47.6740, lng: -122.1215, name: 'Redmond Amp' },
    { eui: 'fake000000000007', lat: 47.3073, lng: -122.2285, name: 'Auburn Hub' },
    { eui: 'fake000000000008', lat: 47.1958, lng: -122.2961, name: 'Puyallup Node' },
    { eui: 'fake000000000009', lat: 47.5301, lng: -122.0326, name: 'Issaquah Amp' },
    { eui: 'fake000000000010', lat: 47.3809, lng: -122.2348, name: 'Kent Valley LE' }
];

db.serialize(() => {
    const stmt = db.prepare(`INSERT OR REPLACE INTO amplifiers (eui, model_name, image_url, lat, lng) VALUES (?, ?, ?, ?, ?)`);
    fakeNodes.forEach(node => {
        stmt.run(node.eui, `ACI NexGate - ${node.name}`, 'https://via.placeholder.com/150', node.lat, node.lng);
    });
    stmt.finalize();
    console.log("10 fake offline nodes added to Washington State!");
});

db.close();
