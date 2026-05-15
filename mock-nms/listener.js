const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const db = new sqlite3.Database('./nms_database.db');
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const PORT = process.env.PORT || 3000;

console.log(`MQTT target: ${MQTT_URL}`);
const mqttClient = mqtt.connect(MQTT_URL);

app.get('/api/devices', (req, res) => {
    db.all(`SELECT * FROM amplifiers`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

mqttClient.on('connect', () => {
    console.log("✅ Connected to Mosquitto. Listening for advanced telemetry...");
    mqttClient.subscribe('application/+/device/+/event/up');
});

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const deviceEui = data.deviceInfo ? data.deviceInfo.devEui : "UNKNOWN";
        const telemetry = data.object;

        // NEW CHECK: Look for the real ICD status_code instead of ac_voltage
        if (!telemetry || telemetry.status_code === undefined) return;

        db.get(`SELECT * FROM amplifiers WHERE eui = ?`, [deviceEui], (err, row) => {
            if (row) {
                console.log(`📡 ICD Data routed for EUI: ${deviceEui}`);

                io.emit('telemetry_update', {
                    eui: deviceEui,
                    model: row.model_name,
                    lat: row.lat,
                    lng: row.lng,
                    telemetry: telemetry
                });

                simulateGhostDevices(telemetry);
            }
        });
    } catch (error) {
        console.error("Error parsing message:", error);
    }
});

// --- DYNAMIC GHOST DEVICE SIMULATOR ---
function simulateGhostDevices(baseTel) {
    db.all(`SELECT * FROM amplifiers ORDER BY lat DESC`, [], (err, rows) => {
        if (err || !rows || rows.length < 3) return;

        const simulationRows = rows.slice(1, rows.length - 1);

        simulationRows.forEach((row, index) => {
            if (row.eui === 'bc8d9d318b84a523') return;

            let simTel = JSON.parse(JSON.stringify(baseTel));
            if (!simTel.alarms) simTel.alarms = {};
            
            // DESIGNATE THE "PROBLEM" AMPS: Only the 1st and 3rd ghost amps can fluctuate wildly
            const isProblematic = (index === 0 || index === 2);

            if (isProblematic) {
                // Wild Swings (Can trigger alarms)
                simTel.temperature_c += (Math.floor(Math.random() * 12) - 4); 
                simTel.rail_24v = parseFloat((simTel.rail_24v + (Math.random() * 1.6 - 0.8)).toFixed(2));
            } else {
                // Stable Operation (Locked strictly into safe, green zones)
                simTel.temperature_c = Math.floor(33 + (Math.random() * 5)); // Always 33C to 38C
                simTel.rail_24v = parseFloat((23.8 + (Math.random() * 0.4)).toFixed(2)); // Always 23.8V to 24.2V
                simTel.alarms.rf_low_unlock = false;
                simTel.alarms.rf_high_unlock = false;
            }

            // Minor safe fluctuations for everyone
            simTel.ripple_24v_mv += (Math.floor(Math.random() * 20) - 10);
            simTel.rf_output_dbmv = parseFloat((simTel.rf_output_dbmv + (Math.random() * 2 - 1)).toFixed(1));
            
            if(simTel.pilot_low_pwr) simTel.pilot_low_pwr = parseFloat((simTel.pilot_low_pwr + (Math.random() * 1.0 - 0.5)).toFixed(1));
            if(simTel.pilot_high_pwr) simTel.pilot_high_pwr = parseFloat((simTel.pilot_high_pwr + (Math.random() * 1.0 - 0.5)).toFixed(1));
            if(simTel.out_slope) simTel.out_slope = parseFloat((simTel.out_slope + (Math.random() * 0.4 - 0.2)).toFixed(1));

            // Recalculate Alarms
            simTel.alarms.temp_critical = (simTel.temperature_c > 40);
            simTel.alarms.power_anomaly = (simTel.rail_24v > 24.5 || simTel.rail_24v < 23.5);
            
            // Set Master Status
            simTel.status_code = (simTel.alarms.temp_critical || simTel.alarms.power_anomaly || simTel.alarms.rf_low_unlock) ? 2 : 1;

            io.emit('telemetry_update', { eui: row.eui, model: row.model_name, lat: row.lat, lng: row.lng, telemetry: simTel });
        });
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 NMS Web Dashboard is running! http://localhost:${PORT}`);
});
