"""
Mint a Firebase ID token for local API testing (Swagger, curl, Postman).

Uses the Identity Toolkit REST API with an email/password account, so it needs
no Admin SDK credential and never touches production data on its own.

Usage, from backend/:
    set FIREBASE_WEB_API_KEY=<the NEXT_PUBLIC_FIREBASE_API_KEY value>
    python -m scripts.get_test_token user@example.com their-password

The printed token goes in the Swagger "Authorize" box (or an
`Authorization: Bearer ...` header) and is valid for about an hour.
"""

import os
import sys

import httpx


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)

    api_key = os.getenv("FIREBASE_WEB_API_KEY") or os.getenv(
        "NEXT_PUBLIC_FIREBASE_API_KEY"
    )
    if not api_key:
        raise SystemExit(
            "Set FIREBASE_WEB_API_KEY (the Firebase web API key) first."
        )

    email, password = sys.argv[1], sys.argv[2]
    try:
        response = httpx.post(
            "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword",
            params={"key": api_key},
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise SystemExit(f"Could not reach Firebase: {exc}") from exc

    if response.status_code != 200:
        try:
            detail = response.json()["error"]["message"]
        except Exception:  # noqa: BLE001
            detail = response.text
        raise SystemExit(f"Sign-in failed: {detail}")

    print(response.json()["idToken"])


if __name__ == "__main__":
    main()
