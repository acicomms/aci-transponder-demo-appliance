# Release Notes

## v0.2-udp-us915

Changes:

- Confirmed ChirpStack Docker baseline works in WSL2 / Docker Desktop
- Disabled Basics Station Gateway Bridge
- Selected Semtech UDP Packet Forwarder as gateway interface
- Exposed UDP port 1700
- Changed MQTT topic prefix from `eu868` to `us915_0`
- Documented ACI GFSK-over-coax Layer 1 difference

Pending:

- ACI NMS container
- Real ACI gateway packet forwarder test
- Dell OptiPlex Ubuntu Server deployment
- Golden image creation

## v0.1-lab-test

Initial working ChirpStack Docker baseline.

Tested environment:

- Windows 11
- WSL2 Ubuntu
- Docker Desktop
- ChirpStack Web UI available at http://localhost:8080

Included services:

- ChirpStack
- PostgreSQL
- Redis
- Mosquitto MQTT
- ChirpStack Gateway Bridge

Notes:

- Current structure uses ChirpStack Docker baseline `configuration/` folder.
- ACI NMS is not added yet.
- Appliance installation on Ubuntu Server is pending Dell OptiPlex 7060 arrival.
