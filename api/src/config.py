from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BUILD_DIR = PROJECT_ROOT / "build"


def load_local_environment() -> None:
    # api/.env first, then backend/.env (where the deployed server keeps the
    # Centro key). Process environment and earlier files win.
    for env_path in (PROJECT_ROOT / "api" / ".env", PROJECT_ROOT / "backend" / ".env"):
        if not env_path.is_file():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")
            if key:
                os.environ.setdefault(key, value)


def allowed_cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://localhost:3002,"
            "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002",
        ).split(",")
        if origin.strip()
    ]


def centro_api_key() -> str | None:
    return os.environ.get("CENTRO_API_KEY")


def is_debug() -> bool:
    return os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}


def server_port() -> int:
    return int(os.environ.get("PORT", "5001"))


def testing_mode() -> bool:
    return os.environ.get("FLASK_TESTING", "").lower() in {"1", "true", "yes"}
