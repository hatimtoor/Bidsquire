import os
from functools import wraps
from rest_framework.response import Response
from rest_framework import status

# The secret your Next.js frontend sends with every request to Django.
# Set INTERNAL_API_SECRET in your environment. Must match DJANGO_INTERNAL_SECRET in .env.
INTERNAL_API_SECRET = os.environ.get('INTERNAL_API_SECRET', '')


def require_internal_secret(view_func):
    """
    Decorator that checks for a shared secret header on every request.
    Apply to any endpoint that should only be callable by the Next.js backend.

    The frontend must send:
        X-Internal-Secret: <value of INTERNAL_API_SECRET>

    n8n webhooks (receive_webhook_data) are exempt because they come from outside.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not INTERNAL_API_SECRET:
            # If the env var isn't set, skip the check (dev mode fallback).
            # Log a warning so it's obvious in production logs.
            print("WARNING: INTERNAL_API_SECRET is not set. Auth check skipped.")
            return view_func(request, *args, **kwargs)

        incoming_secret = request.headers.get('X-Internal-Secret', '')
        if incoming_secret != INTERNAL_API_SECRET:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        return view_func(request, *args, **kwargs)
    return wrapper
