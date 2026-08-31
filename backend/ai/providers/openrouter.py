"""OpenRouter provider — the default AI provider."""

from ... import config
from .base_provider import AIProvider


class OpenRouterProvider(AIProvider):
    name = "openrouter"
    base_url = config.OPENROUTER_BASE_URL
    api_key = config.OPENROUTER_API_KEY
    model = config.OPENROUTER_MODEL
    timeout = config.AI_TIMEOUT_SECONDS