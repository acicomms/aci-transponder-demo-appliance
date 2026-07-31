#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import requests
import yaml


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "config.local.yaml"
DEFAULT_TOKEN_PATH = SCRIPT_DIR / ".chirpstack-bootstrap-token"
DEFAULT_API_URL = "http://localhost:8090"


class BootstrapError(RuntimeError):
    """Raised when bootstrap provisioning cannot continue."""


class ChirpStackAPI:
    def __init__(self, base_url: str, token: str, timeout: int = 15) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        )

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise BootstrapError(
                f"Unable to connect to ChirpStack REST API at {url}: {exc}"
            ) from exc

        if not response.ok:
            body = response.text.strip()

            raise BootstrapError(
                f"ChirpStack API request failed:\n"
                f"  Method: {method}\n"
                f"  URL: {response.url}\n"
                f"  Status: {response.status_code}\n"
                f"  Response: {body or '<empty>'}"
            )

        if not response.content:
            return {}

        try:
            return response.json()
        except ValueError as exc:
            raise BootstrapError(
                f"ChirpStack returned invalid JSON from {response.url}"
            ) from exc

    def get(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self.request("GET", path, params=params)

    def post(
        self,
        path: str,
        *,
        json_data: dict[str, Any],
    ) -> dict[str, Any]:
        return self.request("POST", path, json_data=json_data)

    def put(
        self,
        path: str,
        *,
        json_data: dict[str, Any],
    ) -> dict[str, Any]:
        return self.request("PUT", path, json_data=json_data)

    def get_optional(
        self,
        path: str,
    ) -> dict[str, Any] | None:
        """
        Return None when the requested ChirpStack resource does not exist.
        Raise an error for all other unsuccessful responses.
        """
        url = f"{self.base_url}{path}"

        try:
            response = self.session.get(
                url,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise BootstrapError(
                f"Unable to connect to ChirpStack REST API at {url}: {exc}"
            ) from exc

        if response.status_code == 404:
            return None

        if not response.ok:
            raise BootstrapError(
                f"ChirpStack API request failed:\n"
                f"  Method: GET\n"
                f"  URL: {response.url}\n"
                f"  Status: {response.status_code}\n"
                f"  Response: {response.text.strip() or '<empty>'}"
            )

        if not response.content:
            return {}

        try:
            return response.json()
        except ValueError as exc:
            raise BootstrapError(
                f"ChirpStack returned invalid JSON from {response.url}"
            ) from exc


def load_config(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise BootstrapError(f"Configuration file not found: {path}")

    try:
        with path.open("r", encoding="utf-8") as file_handle:
            config = yaml.safe_load(file_handle)
    except yaml.YAMLError as exc:
        raise BootstrapError(f"Invalid YAML in {path}: {exc}") from exc

    if not isinstance(config, dict):
        raise BootstrapError(f"Configuration root must be a YAML object: {path}")

    required_sections = [
        "tenant",
        "application",
        "device_profile",
        "gateway",
        "devices",
    ]

    missing = [name for name in required_sections if name not in config]

    if missing:
        raise BootstrapError(
            "Missing configuration section(s): " + ", ".join(missing)
        )

    devices = config["devices"]

    if not isinstance(devices, list) or not devices:
        raise BootstrapError("The devices section must contain at least one device")

    return config


def load_token(path: Path) -> str:
    if not path.is_file():
        raise BootstrapError(
            f"API token file not found: {path}\n"
            "Run bootstrap.sh first so it can create the ChirpStack API token."
        )

    token = path.read_text(encoding="utf-8").strip()

    if not token:
        raise BootstrapError(f"API token file is empty: {path}")

    return token


def find_tenant(
    api: ChirpStackAPI,
    tenant_name: str,
) -> dict[str, Any]:
    response = api.get(
        "/api/tenants",
        params={
            "limit": 100,
            "search": tenant_name,
        },
    )

    for tenant in response.get("result", []):
        if tenant.get("name") == tenant_name:
            return tenant

    raise BootstrapError(
        f'Tenant "{tenant_name}" was not found in ChirpStack'
    )


def ensure_application(
    api: ChirpStackAPI,
    *,
    tenant_id: str,
    name: str,
    description: str,
) -> str:
    response = api.get(
        "/api/applications",
        params={
            "limit": 100,
            "tenantId": tenant_id,
            "search": name,
        },
    )

    for application in response.get("result", []):
        if application.get("name") == name:
            application_id = application.get("id")

            if not application_id:
                raise BootstrapError(
                    f'Existing application "{name}" has no ID'
                )

            print(f'✓ Application already exists: {name}')
            print(f"  Application ID: {application_id}")
            return application_id

    response = api.post(
        "/api/applications",
        json_data={
            "application": {
                "name": name,
                "description": description,
                "tenantId": tenant_id,
            }
        },
    )

    application_id = response.get("id")

    if not application_id:
        raise BootstrapError(
            f'Application "{name}" was created but no ID was returned'
        )

    print(f'✓ Application created: {name}')
    print(f"  Application ID: {application_id}")

    return application_id

def ensure_device_profile(
    api: ChirpStackAPI,
    *,
    tenant_id: str,
    config: dict[str, Any],
) -> str:
    name = config["name"]

    response = api.get(
        "/api/device-profiles",
        params={
            "limit": 100,
            "tenantId": tenant_id,
            "tenantOnly": "true",
            "search": name,
        },
    )

    for profile in response.get("result", []):
        if profile.get("name") == name:
            profile_id = profile.get("id")

            if not profile_id:
                raise BootstrapError(
                    f'Existing device profile "{name}" has no ID'
                )

            print(f"✓ Device profile already exists: {name}")
            print(f"  Device Profile ID: {profile_id}")
            return profile_id

    response = api.post(
        "/api/device-profiles",
        json_data={
            "deviceProfile": {
                "tenantId": tenant_id,
                "name": name,
                "description": config.get("description", ""),
                "region": config.get("region", "US915"),
                "macVersion": config.get(
                    "mac_version",
                    "LORAWAN_1_0_4",
                ),
                "regParamsRevision": config.get(
                    "reg_params_revision",
                    "RP002_1_0_3",
                ),
                "adrAlgorithmId": "default",
                "flushQueueOnActivate": config.get(
                    "flush_queue_on_activate",
                    True,
                ),
                "supportsOtaa": config.get("supports_otaa", True),
                "supportsClassB": config.get(
                    "supports_class_b",
                    False,
                ),
                "supportsClassC": config.get(
                    "supports_class_c",
                    True,
                ),
                "classCTimeout": 0,
                "uplinkInterval": 60,
                "deviceStatusReqInterval": 0,
                "payloadCodecRuntime": "NONE",
            }
        },
    )

    profile_id = response.get("id")

    if not profile_id:
        raise BootstrapError(
            f'Device profile "{name}" was created but no ID was returned'
        )

    print(f"✓ Device profile created: {name}")
    print(f"  Device Profile ID: {profile_id}")

    return profile_id


def ensure_gateway(
    api: ChirpStackAPI,
    *,
    tenant_id: str,
    config: dict[str, Any],
) -> str:
    gateway_id = config["gateway_id"].lower()

    response = api.get(
        "/api/gateways",
        params={
            "limit": 100,
            "tenantId": tenant_id,
        },
    )

    for gateway in response.get("result", []):
        if gateway.get("gatewayId", "").lower() == gateway_id:
            print(f"✓ Gateway already exists: {config['name']}")
            print(f"  Gateway ID: {gateway_id}")
            return gateway_id

    api.post(
        "/api/gateways",
        json_data={
            "gateway": {
                "gatewayId": gateway_id,
                "tenantId": tenant_id,
                "name": config["name"],
                "description": config.get("description", ""),
                "statsInterval": 30,
                "tags": {
                    "system": "aci-demo-appliance",
                },
            }
        },
    )

    print(f"✓ Gateway created: {config['name']}")
    print(f"  Gateway ID: {gateway_id}")

    return gateway_id

def normalize_hex(
    value: str,
    *,
    field_name: str,
    expected_length: int,
) -> str:
    normalized = str(value).strip().lower().replace(" ", "")

    if len(normalized) != expected_length:
        raise BootstrapError(
            f"{field_name} must contain exactly "
            f"{expected_length} hexadecimal characters: {value}"
        )

    try:
        int(normalized, 16)
    except ValueError as exc:
        raise BootstrapError(
            f"{field_name} contains non-hexadecimal characters: {value}"
        ) from exc

    return normalized


def ensure_device(
    api: ChirpStackAPI,
    *,
    application_id: str,
    device_profile_id: str,
    config: dict[str, Any],
) -> str:
    name = config["name"]

    dev_eui = normalize_hex(
        config["dev_eui"],
        field_name=f"{name} DevEUI",
        expected_length=16,
    )

    join_eui = normalize_hex(
        config.get("join_eui", "0000000000000000"),
        field_name=f"{name} JoinEUI",
        expected_length=16,
    )

    existing = api.get_optional(f"/api/devices/{dev_eui}")

    device_data = {
        "device": {
            "devEui": dev_eui,
            "name": name,
            "description": config.get(
                "description",
                "ACI demo transponder",
            ),
            "applicationId": application_id,
            "deviceProfileId": device_profile_id,
            "joinEui": join_eui,
            "skipFcntCheck": False,
            "isDisabled": False,
            "tags": {
                "system": "aci-demo-appliance",
                "device-type": "transponder",
            },
        }
    }

    if existing is not None:
        existing_device = existing.get("device", existing)

        existing_application_id = existing_device.get("applicationId")
        existing_profile_id = existing_device.get("deviceProfileId")
        existing_join_eui = existing_device.get("joinEui", "").lower()

        requires_update = (
            existing_device.get("name") != name
            or existing_application_id != application_id
            or existing_profile_id != device_profile_id
            or existing_join_eui != join_eui
        )

        if requires_update:
            api.put(
                f"/api/devices/{dev_eui}",
                json_data=device_data,
            )
            print(f"✓ Device updated: {name}")
        else:
            print(f"✓ Device already exists: {name}")

        print(f"  DevEUI: {dev_eui}")
        return dev_eui

    api.post(
        "/api/devices",
        json_data=device_data,
    )

    print(f"✓ Device created: {name}")
    print(f"  DevEUI: {dev_eui}")

    return dev_eui


def ensure_device_keys(
    api: ChirpStackAPI,
    *,
    dev_eui: str,
    app_key: str,
) -> None:
    normalized_key = normalize_hex(
        app_key,
        field_name=f"{dev_eui} AppKey",
        expected_length=32,
    )

    existing = api.get_optional(
        f"/api/devices/{dev_eui}/keys"
    )

    # For LoRaWAN 1.0.x, ChirpStack uses nwkKey for the device AppKey.
    key_data = {
        "deviceKeys": {
            "devEui": dev_eui,
            "nwkKey": normalized_key,
        }
    }

    if existing is None:
        api.post(
            f"/api/devices/{dev_eui}/keys",
            json_data=key_data,
        )
        print("  ✓ OTAA AppKey created")
        return

    existing_keys = existing.get("deviceKeys", existing)
    current_key = existing_keys.get("nwkKey", "").lower()

    if current_key == normalized_key:
        print("  ✓ OTAA AppKey already configured")
        return

    api.put(
        f"/api/devices/{dev_eui}/keys",
        json_data=key_data,
    )

    print("  ✓ OTAA AppKey updated")


def ensure_devices(
    api: ChirpStackAPI,
    *,
    application_id: str,
    device_profile_id: str,
    devices: list[dict[str, Any]],
) -> list[str]:
    provisioned_devices: list[str] = []

    for device_config in devices:
        dev_eui = ensure_device(
            api,
            application_id=application_id,
            device_profile_id=device_profile_id,
            config=device_config,
        )

        ensure_device_keys(
            api,
            dev_eui=dev_eui,
            app_key=device_config["app_key"],
        )

        provisioned_devices.append(dev_eui)
        print()

    return provisioned_devices

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Provision the ACI ChirpStack demo environment"
    )

    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help=f"YAML configuration file (default: {DEFAULT_CONFIG_PATH})",
    )

    parser.add_argument(
        "--token-file",
        type=Path,
        default=DEFAULT_TOKEN_PATH,
        help=f"ChirpStack token file (default: {DEFAULT_TOKEN_PATH})",
    )

    parser.add_argument(
        "--api-url",
        default=DEFAULT_API_URL,
        help=f"ChirpStack REST API URL (default: {DEFAULT_API_URL})",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    print("Loading bootstrap configuration...")
    config = load_config(args.config)

    devices = config["devices"]
    gateway_id = config["gateway"]["gateway_id"]

    print(f"✓ Configuration loaded: {args.config}")
    print(f"✓ Demo devices configured: {len(devices)}")
    print(f"✓ Gateway ID configured: {gateway_id}")
    print()

    token = load_token(args.token_file)
    api = ChirpStackAPI(args.api_url, token)

    print("Connecting to ChirpStack...")

    tenant_name = config["tenant"]["name"]
    tenant = find_tenant(api, tenant_name)
    tenant_id = tenant.get("id")

    if not tenant_id:
        raise BootstrapError(
            f'Tenant "{tenant_name}" was found but has no ID'
        )

    print(f"✓ Authentication successful")
    print(f"✓ Tenant found: {tenant_name}")
    print(f"  Tenant ID: {tenant_id}")
    print()

    application_config = config["application"]

    application_id = ensure_application(
        api,
        tenant_id=tenant_id,
        name=application_config["name"],
        description=application_config.get("description", ""),
    )

    print()

    device_profile_id = ensure_device_profile(
        api,
        tenant_id=tenant_id,
        config=config["device_profile"],
    )

    print()

    gateway_id = ensure_gateway(
        api,
        tenant_id=tenant_id,
        config=config["gateway"],
    )

    print()

    print("Provisioning demo transponders...")
    print()

    device_euis = ensure_devices(
     api,
     application_id=application_id,
     device_profile_id=device_profile_id,
     devices=config["devices"],
    )

    print()
    print("Bootstrap milestone complete.")
    print(f"Tenant ID:      {tenant_id}")
    print(f"Application ID: {application_id}")
    print(f"Device Profile ID:      {device_profile_id}")
    print(f"Gateway ID:             {gateway_id}")
    print(f"Devices provisioned:    {len(device_euis)}")

    for dev_eui in device_euis:
        print(f"  - {dev_eui}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BootstrapError as exc:
        print()
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
PY