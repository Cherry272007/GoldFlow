"""Central AI manager.

The rest of GoldFlow never calls a provider directly - it always goes through
AIManager. OpenRouter is the only provider for now; if a second provider is
added later it plugs in behind the same interface and this manager is where
selection/fallback would live.

There is deliberately no provider-to-provider fallback: if OpenRouter fails,
the failure is raised and surfaced as a friendly error (Section 31). The
deterministic technical signal engine (backend.signal_engine) keeps the
dashboard functional while AI is unavailable.
"""

from .. import config
from .base import ProviderUnavailableError
from .providers import get_provider


class AIManager:
    def __init__(self):
        self.provider = get_provider(config.AI_PROVIDER)
        self.name = config.AI_PROVIDER
        self.last_used = {"provider": None, "model": None}

    def analyze(self, market_data, indicators, images=None):
        """Run the provider and return a normalized analysis dict.

        Raises ProviderUnavailableError when the AI call fails; callers
        surface a friendly error and may degrade to the signal engine.
        """
        if not self.provider:
            raise ProviderUnavailableError(
                "AI_PROVIDER is not set to a configured provider"
            )
        result = self.provider.analyze(market_data, indicators, images)
        self.last_used = {
            "provider": self.provider.name,
            "model": self.provider.model,
        }
        result["provider"] = self.provider.name
        result["model"] = self.provider.model
        return result

    @property
    def configured(self):
        return bool(self.provider and self.provider.api_key)

    def status(self):
        return {
            "provider": self.name,
            "model": self.provider.model if self.provider else None,
            "configured": self.configured,
            "last_used": self.last_used,
        }