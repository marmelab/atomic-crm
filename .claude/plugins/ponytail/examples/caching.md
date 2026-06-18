# Caching System

**Task:** "We should cache these API responses."

## Without Ponytail

```python
import time
import threading
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class TTLCache:
    """Thread-safe LRU cache with per-entry TTL and max size."""

    def __init__(self, max_size: int = 1000, default_ttl: float = 300.0):
        self._store: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.Lock()
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None or entry.expires_at < time.monotonic():
                self.misses += 1
                self._store.pop(key, None)
                return None
            self._store.move_to_end(key)
            self.hits += 1
            return entry.value

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        with self._lock:
            if len(self._store) >= self.max_size:
                self._store.popitem(last=False)
            self._store[key] = CacheEntry(
                value, time.monotonic() + (ttl or self.default_ttl)
            )

    # ... plus invalidation, stats endpoint, and unit tests for all of it
```

120 lines of custom infrastructure for a problem nobody has measured yet.

## With Ponytail

First question: **do you actually need a cache?**

- **Unsure?** Ship without it. Add it when you measure the problem. (YAGNI)
- **Pure function, hot path?** The standard library has it:

  ```python
  # ponytail: stdlib covers this
  from functools import lru_cache

  @lru_cache(maxsize=1000)
  def fetch(key): ...
  ```

- **Real distributed caching needs?** Use Redis / memcached / your platform's
  cache. Infrastructure problems get infrastructure, not a homemade class.

**120 lines → 0–3 lines.** The fastest cache is the one you didn't have to debug.
