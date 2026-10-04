import time
import threading
from typing import Any, Optional, Dict, List

class InMemoryTTLCache:
    """
    High-performance thread-safe in-memory cache with Time-To-Live (TTL) expiration.
    Allows caching expensive read operations (e.g. Neon PostgreSQL queries) to provide
    instant sub-millisecond response times.
    """
    def __init__(self, default_ttl_seconds: int = 30):
        self.default_ttl = default_ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            if time.time() > entry["expires_at"]:
                del self._cache[key]
                return None
            return entry["value"]

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        with self._lock:
            self._cache[key] = {
                "value": value,
                "expires_at": time.time() + ttl
            }

    def delete(self, key: str) -> None:
        with self._lock:
            if key in self._cache:
                del self._cache[key]

    def invalidate_prefix(self, prefix: str) -> None:
        """Invalidate all keys starting with prefix (e.g. 'orders:', 'vehicles:')"""
        with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._cache[k]

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

# Global memory cache instance
memory_cache = InMemoryTTLCache(default_ttl_seconds=30)
