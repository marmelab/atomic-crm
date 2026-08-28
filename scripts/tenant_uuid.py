#!/usr/bin/env python3
"""Deterministic tenant UUID: uuid5(uuid5(DNS, 'ardley-crm.tenants'), customer_id).

Must match sql/seed_w0.sql (uuid-ossp uuid_generate_v5).
"""

from __future__ import annotations

import uuid

TENANT_NS = uuid.uuid5(uuid.NAMESPACE_DNS, "ardley-crm.tenants")

WOODLEY_CUSTOMER_ID = "100004"
ENVOY_CUSTOMER_ID = "100081"


def tenant_uuid(ardley_customer_id: str) -> uuid.UUID:
    return uuid.uuid5(TENANT_NS, ardley_customer_id)


def main() -> None:
    woodley = tenant_uuid(WOODLEY_CUSTOMER_ID)
    envoy = tenant_uuid(ENVOY_CUSTOMER_ID)
    assert woodley != envoy
    assert str(woodley) == "4b51bd26-ea4f-5777-b9d9-780dbb91853e"
    assert str(envoy) == "28dd4130-fe59-5ada-a3ce-78c82259e9dd"
    print(f"namespace {TENANT_NS}")
    print(f"woodley  {WOODLEY_CUSTOMER_ID} {woodley}")
    print(f"envoy    {ENVOY_CUSTOMER_ID} {envoy}")


if __name__ == "__main__":
    main()
