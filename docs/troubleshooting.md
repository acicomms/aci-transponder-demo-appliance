docker compose ps
docker compose logs -f
docker compose logs -f chirpstack
docker compose logs -f chirpstack-gateway-bridge
docker compose logs -f mosquitto
ss -lunp | grep 1700
ss -ltnp | grep 8080
docker compose restart
docker compose down --remove-orphans
docker compose up -d