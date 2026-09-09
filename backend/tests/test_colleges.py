import pytest
from httpx import AsyncClient
from unittest.mock import patch


class TestColleges:
    @pytest.mark.asyncio
    async def test_list_colleges(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid"}
            
            response = await client.get("/colleges/")
            
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_list_colleges_with_filters(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid"}
            
            response = await client.get("/colleges/?stream=UG&state=Tamil Nadu&search=VIT")
            
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_college(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid"}
            
            response = await client.get("/colleges/00000000-0000-0000-0000-000000000000")
            
            assert response.status_code in [200, 404]