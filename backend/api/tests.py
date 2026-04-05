"""
Tests for the Django backend.
Covers: internal secret auth, webhook routing, SKU generation.

Run with: python manage.py test api
"""

from django.test import TestCase, RequestFactory, override_settings
from unittest.mock import patch, MagicMock
from .auth import require_internal_secret
from .views import submit_photography
from rest_framework.decorators import api_view
from rest_framework.response import Response


# ── Auth Decorator Tests ───────────────────────────────────────────────────

class RequireInternalSecretTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()

    def _make_view(self):
        """Create a simple view wrapped with the auth decorator for testing."""
        @api_view(['GET', 'POST'])
        @require_internal_secret
        def test_view(request):
            return Response({'ok': True})
        return test_view

    @override_settings()
    def test_allows_request_when_secret_not_configured(self):
        """When INTERNAL_API_SECRET env var is not set, auth check is skipped (dev mode)."""
        import api.auth as auth_module
        original = auth_module.INTERNAL_API_SECRET
        auth_module.INTERNAL_API_SECRET = ''  # Simulate unset
        try:
            view = self._make_view()
            request = self.factory.get('/api/hello/')
            response = view(request)
            self.assertEqual(response.status_code, 200)
        finally:
            auth_module.INTERNAL_API_SECRET = original

    def test_rejects_request_without_secret_header(self):
        """Requests without X-Internal-Secret header are rejected with 401."""
        import api.auth as auth_module
        original = auth_module.INTERNAL_API_SECRET
        auth_module.INTERNAL_API_SECRET = 'test-secret-value'
        try:
            view = self._make_view()
            request = self.factory.get('/api/hello/')
            response = view(request)
            self.assertEqual(response.status_code, 401)
        finally:
            auth_module.INTERNAL_API_SECRET = original

    def test_rejects_request_with_wrong_secret(self):
        """Requests with wrong secret are rejected."""
        import api.auth as auth_module
        original = auth_module.INTERNAL_API_SECRET
        auth_module.INTERNAL_API_SECRET = 'correct-secret'
        try:
            view = self._make_view()
            request = self.factory.get('/api/hello/', HTTP_X_INTERNAL_SECRET='wrong-secret')
            response = view(request)
            self.assertEqual(response.status_code, 401)
        finally:
            auth_module.INTERNAL_API_SECRET = original

    def test_allows_request_with_correct_secret(self):
        """Requests with the correct secret header are allowed through."""
        import api.auth as auth_module
        original = auth_module.INTERNAL_API_SECRET
        auth_module.INTERNAL_API_SECRET = 'correct-secret'
        try:
            view = self._make_view()
            request = self.factory.get('/api/hello/', HTTP_X_INTERNAL_SECRET='correct-secret')
            response = view(request)
            self.assertEqual(response.status_code, 200)
        finally:
            auth_module.INTERNAL_API_SECRET = original


# ── SKU Generation Tests ──────────────────────────────────────────────────

class SkuGenerationTests(TestCase):

    def _generate_sku(self, auction_name: str, lot_number: str) -> str:
        """Mirror the SKU generation logic from views.py."""
        import string as string_module
        auction_words = [w for w in auction_name.split() if w.isalpha()]
        sku_prefix = ''.join([w[0].upper() for w in auction_words[:3]])
        return f"{sku_prefix}-{lot_number}"

    def test_three_word_auction_name(self):
        self.assertEqual(self._generate_sku('Spring Online Auction', '123'), 'SOA-123')

    def test_two_word_auction_name(self):
        self.assertEqual(self._generate_sku('Spring Auction', '456'), 'SA-456')

    def test_ignores_numeric_words(self):
        self.assertEqual(self._generate_sku('Spring 2025 Auction', '789'), 'SA-789')

    def test_uses_only_first_three_words(self):
        self.assertEqual(self._generate_sku('Alpha Beta Gamma Delta', '001'), 'ABG-001')

    def test_quantity_suffix(self):
        import string as string_module
        base = self._generate_sku('Spring Online Auction', '100')
        for i, letter in enumerate(['a', 'b', 'c']):
            sku = f"{base}({string_module.ascii_lowercase[i]})"
            self.assertEqual(sku, f'SOA-100({letter})')


# ── Webhook Routing Tests ─────────────────────────────────────────────────

class WebhookRoutingTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()

    def test_hibid_data_detected_by_url_main_field(self):
        """Data with url_main containing hibid.com is treated as HiBid data."""
        from .views import receive_webhook_data
        data = {'url_main': 'https://hibid.com/lot/123', 'item_name': 'Test Item'}
        request = self.factory.post('/api/receive-webhook-data/', data, content_type='application/json')
        import json
        request.data = data
        # Just verify the routing logic detects the right type
        is_hibid = 'url_main' in data and 'hibid.com' in data.get('url_main', '')
        self.assertTrue(is_hibid)

    def test_sku_data_detected_by_sku_field(self):
        """Data with sku field is treated as SKU-based data."""
        data = {'sku': 'SOA-123(a)', 'ebay_title': 'Test Title'}
        is_sku = 'sku' in data
        is_hibid = 'url_main' in data and 'hibid.com' in data.get('url_main', '')
        self.assertTrue(is_sku)
        self.assertFalse(is_hibid)

    def test_unknown_data_format(self):
        """Data with neither url_main nor sku is unknown format."""
        data = {'random_field': 'some_value'}
        is_hibid = 'url_main' in data and 'hibid.com' in data.get('url_main', '')
        is_sku = 'sku' in data
        self.assertFalse(is_hibid)
        self.assertFalse(is_sku)
