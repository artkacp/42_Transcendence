from django.core.cache import caches
from rest_framework.throttling import SimpleRateThrottle


# Correct only because the backend is a single Daphne process: LocMemCache lives in
# that process's memory, so this one cache sees every request and its counts are the
# whole truth. A second process would keep its own counters, and each key could make
# its full limit of requests once per process.
class APIKeyRateThrottle(SimpleRateThrottle):
    cache = caches['throttle']
    # Default for keys whose rate_per_minute is null; parsed once by SimpleRateThrottle.__init__.
    rate = '60/min'

    # DRF builds a new throttle for every request, so changing num_requests affects only this one.
    # `is not None` rather than `or`: 0 blocks the key, null means the default.
    def allow_request(self, request, view):
        if request.auth.rate_per_minute is not None:
            self.num_requests = request.auth.rate_per_minute
        return super().allow_request(request, view)

    # The throttle cache holds nothing else, so the key id alone is the cache key.
    def get_cache_key(self, request, view):
        return str(request.auth.id)

    # After a key's limit is lowered mid-minute, more requests can be counted than the new
    # limit; DRF's wait() then returns None and the 429 has no Retry-After. Answer with
    # the time until enough of the oldest requests expire to get back under the limit.
    def wait(self):
        if len(self.history) > self.num_requests:
            return self.history[self.num_requests - 1] + self.duration - self.now
        return super().wait()
