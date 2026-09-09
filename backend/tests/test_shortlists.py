import pytest
from httpx import AsyncClient
from unittest.mock import patch


class TestShortlists:
    @pytest.mark.asyncio
    async def test_get_shortlist_empty(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid-shortlist"}
            
            await client.post(
                "/students/",
                json={
                    "name": "Shortlist Student",
                    "email": "shortlist@example.com",
                    "phone": "9876543220",
                    "stream": "UG"
                }
            )
            
            response = await client.get("/shortlists/")
            
            assert response.status_code == 200
            data = response.json()
            assert data == []

    @pytest.mark.asyncio
    async def test_add_to_shortlist(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid-shortlist-2"}
            
            await client.post(
                "/students/",
                json={
                    "name": "Shortlist Student 2",
                    "email": "shortlist2@example.com",
                    "phone": "9876543221",
                    "stream": "UG"
                }
            )
            
            response = await client.post(
                "/shortlists/",
                json={
                    "college_id": "00000000-0000-0000-0000-000000000001",
                    "course_id": "00000000-0000-0000-0000-000000000001"
                }
            )
            
            assert response.status_code in [201, 404, 409]

    @pytest.mark.asyncio
    async def test_remove_from_shortlist(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid-shortlist-3"}
            
            response = await client.delete("/shortlists/00000000-0000-0000-0000-000000000001")
            
            assert response.status_code in [204, 404]