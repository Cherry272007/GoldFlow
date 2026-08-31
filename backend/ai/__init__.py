"""AI subsystem: provider abstraction, manager, and deterministic fallback."""

from .base import (ProviderError, ProviderUnavailableError,
                   normalize_analysis)
from .manager import AIManager

__all__ = [
    "AIManager",
    "ProviderError",
    "ProviderUnavailableError",
    "normalize_analysis",
]