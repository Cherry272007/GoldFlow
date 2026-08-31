"""AI provider registry.

OpenRouter is the only provider implemented today. The base interface keeps
the door open for a second provider (e.g. Anthropic, Google) to be added here
later without touching the frontend, signal engine, or market-data system.
"""

from .base_provider import AIProvider
from .openrouter import OpenRouterProvider

__all__ = ["AIProvider", "OpenRouterProvider", "PROVIDERS", "get_provider"]

PROVIDERS = {
    "openrouter": OpenRouterProvider,
}


def get_provider(name):
    """Instantiate a provider by name, or None for unknown/empty names."""
    name = (name or "").lower().strip()
    cls = PROVIDERS.get(name)
    return cls() if cls else None