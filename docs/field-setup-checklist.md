# Field Setup Checklist

## Before Shipping

- [ ] Appliance boots successfully
- [ ] Docker services start automatically
- [ ] ChirpStack Web UI opens on port 8080
- [ ] UDP port 1700 is listening
- [ ] MQTT port 1883 is listening
- [ ] Tailscale SSH is connected
- [ ] Hostname is updated
- [ ] Appliance label is attached
- [ ] Power adapter included
- [ ] Ethernet cable included

## Customer Network Info

- [ ] DHCP available?
- [ ] Static IP required?
- [ ] Internet access available?
- [ ] Outbound HTTPS allowed?
- [ ] Outbound Tailscale allowed?
- [ ] Customer firewall allows UDP packet forwarder traffic to appliance UDP 1700?
- [ ] Customer allows ACI remote SSH through Tailscale?

## Demo Info

- [ ] Customer name:
- [ ] Site:
- [ ] Appliance hostname:
- [ ] Local IP:
- [ ] Tailscale IP:
- [ ] ChirpStack URL:
- [ ] Gateway ID:
- [ ] Region: US915
- [ ] MQTT topic prefix: us915_0