"""Patterns seen per route, merged over time.

Centro's getpatterns only returns patterns it currently considers active, so
one call can miss a direction. Remembering every pattern seen (and seeding
from docs/centro-routes.json at startup) keeps stop order and trip math
working for both directions all day.
"""
from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

from .centro_client import CentroAPIError


class PatternStore:
    def __init__(self):
        self._by_route: dict[str, dict[str, dict]] = {}
        self._lock = Lock()

    def remember(self, route_id: str, patterns: list[dict]) -> None:
        with self._lock:
            known = self._by_route.setdefault(route_id, {})
            for pattern in patterns or []:
                if pattern.get("pid") is not None:
                    known[str(pattern["pid"])] = pattern

    def for_route(self, route_id: str) -> list[dict]:
        with self._lock:
            return list(self._by_route.get(route_id, {}).values())

    def get(self, pattern_id: str) -> dict | None:
        with self._lock:
            for patterns in self._by_route.values():
                if str(pattern_id) in patterns:
                    return patterns[str(pattern_id)]
        return None

    def seed_from_reference(self, path: Path) -> int:
        try:
            routes = json.loads(Path(path).read_text(encoding="utf-8")).get("routes") or []
        except (OSError, ValueError, AttributeError):
            return 0
        count = 0
        for route in routes:
            patterns = route.get("patterns") or []
            self.remember(str(route.get("id")), patterns)
            count += len(patterns)
        return count


_store = PatternStore()


def get_store() -> PatternStore:
    return _store


def reset_store() -> None:
    global _store
    _store = PatternStore()


def refresh(client, route_id: str) -> list[dict]:
    try:
        get_store().remember(route_id, client.patterns(route_id).get("ptr") or [])
    except CentroAPIError:
        pass
    return get_store().for_route(route_id)


def pattern_by_id(client, route_id: str, pattern_id: str) -> dict | None:
    known = get_store().get(pattern_id)
    if known is not None:
        return known
    try:
        patterns = client.pattern(pattern_id).get("ptr") or []
    except CentroAPIError:
        return None
    get_store().remember(route_id, patterns)
    return get_store().get(pattern_id)
