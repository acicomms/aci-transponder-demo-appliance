const sqlite3 = require('sqlite3').verbose();

// This will automatically create a file named 'nms_database.db' in your folder
const db = new sqlite3.Database('./nms_database.db');

db.serialize(() => {
    // 1. Create the Asset Table
    db.run(`CREATE TABLE IF NOT EXISTS amplifiers (
        eui TEXT PRIMARY KEY,
        model_name TEXT,
        image_url TEXT,
        lat REAL,
        lng REAL
    )`);

    // 2. Insert your specific Heltec device
    const stmt = db.prepare(`INSERT OR REPLACE INTO amplifiers (eui, model_name, image_url, lat, lng) VALUES (?, ?, ?, ?, ?)`);
    
    stmt.run(
        'bc8d9d318b84a523',                                   // Your exact Device EUI
        'ACI NexGate Transponder',                            // The Model Name
        'https://via.placeholder.com/150?text=NexGate+Amp',   // Placeholder image URL
        47.4184,                                              // Latitude for Kent, WA
        -122.2552                                             // Longitude for Kent, WA
    );
    
    stmt.finalize();
});

db.close(() => {
    console.log("Success! SQLite database created and seeded with your device.");
});
