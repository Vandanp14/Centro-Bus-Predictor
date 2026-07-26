"""Small, defensive client for Centro's Clever Devices BusTime v3 API."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import requests


CENTRO_API_BASE = "https://bus-time.centro.org/bustime/api/v3"


class CentroAPIError(RuntimeError):
    """A safe upstream error that can be returned without leaking credentials."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


@dataclass
class _CacheEntry:
    value: dict[str, Any]
    expires_at: datetime


class CentroClient:
    """Centro BusTime client with a small in-memory response cache."""

    def __init__(
        self,
        api_key: str | None,
        *,
        session: requests.Session | None = None,
        timeout: float = 8.0,
    ):
        self.api_key = (api_key or "").strip()
        self.session = session or requests.Session()
        self.timeout = timeout
        self._cache: dict[tuple[Any, ...], _CacheEntry] = {}
        self._cache_lock = Lock()

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def request(
        self,
        endpoint: str,
        *,
        cache_seconds: int = 0,
        **params: Any,
    ) -> dict[str, Any]:
        if not self.configured:
            raise CentroAPIError(
                "Centro live data is not configured on this server.",
                status_code=503,
            )

        normalized_params = tuple(
            sorted((key, str(value)) for key, value in params.items() if value not in (None, ""))
        )
        cache_key = (endpoint, normalized_params)
        now = datetime.now(timezone.utc)

        if cache_seconds:
            with self._cache_lock:
                cached = self._cache.get(cache_key)
                if cached and cached.expires_at > now:
                    return cached.value

        query = {
            "key": self.api_key,
            "format": "json",
            **{key: value for key, value in params.items() if value not in (None, "")},
        }

        try:
            response = self.session.get(
                f"{CENTRO_API_BASE}/{endpoint}",
                params=query,
                timeout=self.timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.Timeout as exc:
            raise CentroAPIError("Centro took too long to respond.", 504) from exc
        except requests.RequestException as exc:
            raise CentroAPIError("Centro live data is temporarily unavailable.") from exc
        except ValueError as exc:
            raise CentroAPIError("Centro returned an unreadable response.") from exc

        body = payload.get("bustime-response")
        if not isinstance(body, dict):
            raise CentroAPIError("Centro returned an unexpected response.")

        if cache_seconds:
            with self._cache_lock:
                self._cache[cache_key] = _CacheEntry(
                    value=body,
                    expires_at=now + timedelta(seconds=cache_seconds),
                )

        return body

    def routes(self) -> dict[str, Any]:
        return self.request("getroutes", cache_seconds=900)

    def directions(self, route_id: str) -> dict[str, Any]:
        return self.request("getdirections", rt=route_id, cache_seconds=3600)

    def stops(self, route_id: str, direction: str) -> dict[str, Any]:
        return self.request(
            "getstops",
            rt=route_id,
            dir=direction,
            cache_seconds=3600,
        )

    def predictions(
        self,
        route_id: str,
        stop_id: str,
        direction: str | None = None,
    ) -> dict[str, Any]:
        # Direction is filtered by our API after the response. Centro's
        # documented endpoint requires a route plus stop or vehicle identifier.
        return self.request(
            "getpredictions",
            rt=route_id,
            stpid=stop_id,
            cache_seconds=12,
        )

    def vehicles(self, route_id: str) -> dict[str, Any]:
        return self.request("getvehicles", rt=route_id, cache_seconds=8)

    def patterns(self, route_id: str) -> dict[str, Any]:
        return self.request("getpatterns", rt=route_id, cache_seconds=3600)
