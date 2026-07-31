#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP_DIR="${PROJECT_DIR}/bootstrap"
TOKEN_FILE="${BOOTSTRAP_DIR}/.chirpstack-bootstrap-token"
RESULT_FILE="${BOOTSTRAP_DIR}/bootstrap-result.env"
ENV_FILE="${PROJECT_DIR}/.env"
PYTHON_SCRIPT="${BOOTSTRAP_DIR}/bootstrap.py"

cd "${PROJECT_DIR}"

echo "Waiting for ChirpStack..."

until docker compose exec -T chirpstack \
  chirpstack --config /etc/chirpstack print-ds --help \
  >/dev/null 2>&1
do
  sleep 3
done

echo "ChirpStack container is ready."

if [[ ! -s "${TOKEN_FILE}" ]]; then
  echo "Creating ChirpStack global API key..."

  KEY_OUTPUT="$(
    docker compose exec -T chirpstack \
      chirpstack --config /etc/chirpstack \
      create-api-key --name "ACI Bootstrap"
  )"

  API_KEY_ID="$(
    printf '%s\n' "${KEY_OUTPUT}" |
      sed -n 's/^id:[[:space:]]*//p' |
      tail -n 1
  )"

  API_TOKEN="$(
    printf '%s\n' "${KEY_OUTPUT}" |
      sed -n 's/^token:[[:space:]]*//p' |
      tail -n 1
  )"

  if [[ -z "${API_KEY_ID}" || -z "${API_TOKEN}" ]]; then
    echo "Failed to extract API key information."
    echo "${KEY_OUTPUT}"
    exit 1
  fi

  printf '%s\n' "${API_TOKEN}" > "${TOKEN_FILE}"
  chmod 600 "${TOKEN_FILE}"

  echo "API key created successfully."
  echo "API key ID: ${API_KEY_ID}"
  echo "Token saved to: ${TOKEN_FILE}"
else
  echo "Using existing bootstrap token:"
  echo "${TOKEN_FILE}"
fi

echo
echo "Running ChirpStack provisioning..."

python3 "${PYTHON_SCRIPT}"

echo
echo "Reading tenant ID from ChirpStack..."

API_TOKEN="$(<"${TOKEN_FILE}")"

TENANT_RESPONSE="$(
  curl --fail --silent --show-error \
    -H "Authorization: Bearer ${API_TOKEN}" \
    "http://localhost:8090/api/tenants?limit=100"
)"

TENANT_ID="$(
  printf '%s' "${TENANT_RESPONSE}" |
    python3 -c '
import json
import sys

data = json.load(sys.stdin)

for tenant in data.get("result", []):
    if tenant.get("name") == "ChirpStack":
        print(tenant["id"])
        break
'
)"

if [[ -z "${TENANT_ID}" ]]; then
  echo "Unable to find the ChirpStack tenant ID."
  exit 1
fi

cat > "${RESULT_FILE}" <<EOF
CHIRPSTACK_API_TOKEN=${API_TOKEN}
CHIRPSTACK_TENANT_ID=${TENANT_ID}
EOF

chmod 600 "${RESULT_FILE}"

touch "${ENV_FILE}"

set_env_value() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

set_env_value "CHIRPSTACK_API_TOKEN" "${API_TOKEN}"
set_env_value "CHIRPSTACK_TENANT_ID" "${TENANT_ID}"

echo
echo "Updated ${ENV_FILE}:"
echo "CHIRPSTACK_API_TOKEN=<hidden>"
echo "CHIRPSTACK_TENANT_ID=${TENANT_ID}"

echo
echo "Recreating NMS backend with ChirpStack credentials..."

docker compose up -d --force-recreate twoway-nms-backend

echo
echo "Bootstrap completed successfully."
echo "Provisioned:"
echo "  - ACI Demo Application"
echo "  - ACI Transponder US915 device profile"
echo "  - Gateway aabbccddeeff0001"
echo "  - Four demo transponders"
echo "  - OTAA AppKeys"
echo "  - NMS backend credentials"