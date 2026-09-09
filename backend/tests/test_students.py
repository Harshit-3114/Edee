import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
import uuid


class TestStudents:
    @pytest.mark.asyncio
    async def test_create_student(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid"}
            
            response = await client.post(
                "/students/",
                json={
                    "name": "Test Student",
                    "email": "test@example.com",
                    "phone": "9876543210",
                    "stream": "UG"
                }
            )
            
            assert response.status_code == 201
            data = response.json()
            assert data["name"] == "Test Student"
            assert data["stream"] == "UG"
            assert "id" in data

    @pytest.mark.asyncio
    async def test_create_student_duplicate(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid-2"}
            
            await client.post(
                "/students/",
                json={
                    "name": "Test Student 2",
                    "email": "test2@example.com",
                    "phone": "9876543211",
                    "stream": "PG"
                }
            )
            
            response = await client.post(
                "/students/",
                json={
                    "name": "Test Student 2",
                    "email": "test2@example.com",
                    "phone": "9876543211",
                    "stream": "PG"
                }
            )
            
            assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_get_me(self, client: AsyncClient):
        with patch("app.middleware.auth.get_current_user") as mock_auth:
            mock_auth.return_value = {"uid": "test-firebase-uid-3"}
            
            await client.post(
                "/students/",
                json={
                    "name": "Test Student 3",
                    "email": "test3@example.com",
                    "phone": "9876543212",
                    "stream": "UG"
                }
            )
            
            response = await client.get("/students/me")
            
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "Test Student 3"
            assert data["email"] == "test3@example.com"