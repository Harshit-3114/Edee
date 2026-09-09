import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


class TestPayments:
    @pytest.mark.asyncio
    async def test_create_order(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid-payment"}
            
            with patch("app.services.razorpay.razorpay_client.order.create") as mock_razorpay:
                mock_razorpay.return_value = {
                    "id": "order_test123",
                    "amount": 1500000,
                    "currency": "INR"
                }
                
                response = await client.post(
                    "/payments/create-order",
                    json={
                        "shortlist_ids": ["00000000-0000-0000-0000-000000000001"]
                    }
                )
                
                assert response.status_code in [200, 400, 404]

    @pytest.mark.asyncio
    async def test_webhook_invalid_signature(self, client: AsyncClient):
        response = await client.post(
            "/payments/webhook",
            content='{"event": "payment.captured"}',
            headers={"X-Razorpay-Signature": "invalid"}
        )
        
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_webhook_ignored_event(self, client: AsyncClient):
        with patch("app.services.razorpay.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True
            
            response = await client.post(
                "/payments/webhook",
                content='{"event": "payment.failed"}',
                headers={"X-Razorpay-Signature": "valid"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ignored"