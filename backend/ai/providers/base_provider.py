"""AIProvider abstract base shared by all concrete providers."""

from ..base import (ProviderUnavailableError, build_messages,
                    chat_completion, extract_json, normalize_analysis)


class AIProvider:
    """Common interface. Subclasses only configure endpoint attributes.

    The single migration path between providers is the normalized analysis
    dict produced by ``normalize_analysis`` so the rest of GoldFlow is
    provider-agnostic.
    """

    name = "base"
    base_url = ""
    api_key = ""
    model = ""
    timeout = 60

    def analyze(self, market_data, indicators, images=None):
        """Run the provider and return the normalized analysis dict."""
        return self._run(market_data, indicators, images)

    def analyze_market(self, market_data, indicators):
        """Analyze live data + indicators only (no screenshots)."""
        return self.analyze(market_data, indicators)

    def analyze_images(self, images, market_data, indicators):
        """Analyze screenshots plus live data + indicators."""
        return self.analyze(market_data, indicators, images=images)

    def analyze_combined(self, market_data, indicators, images):
        """Explicit combined-analysis entry point."""
        return self.analyze(market_data, indicators, images=images)

    # ------------------------------------------------------------------
    # Shared runtime
    # ------------------------------------------------------------------
    def _run(self, market_data, indicators, images=None):
        if not self.api_key:
            raise ProviderUnavailableError(f"{self.name} API key not configured")
        messages = build_messages(market_data, indicators, images)
        raw = chat_completion(
            self.base_url,
            self.api_key,
            self.model,
            messages,
            timeout=self.timeout,
        )
        parsed = extract_json(raw)
        if parsed is None:
            raise ProviderUnavailableError(f"{self.name} returned invalid JSON")
        result = normalize_analysis(parsed, market_data, indicators)
        result["provider"] = self.name
        result["model"] = self.model
        return result

    @property
    def status(self):
        return {
            "name": self.name,
            "model": self.model,
            "configured": bool(self.api_key),
        }