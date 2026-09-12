"""
Development-only helpers.

Every route here 404s unless dev mode is on — local development without
Firebase — so none of this exists in test, staging or production, not even
as a 403 oracle. The dev sign-in page uses /dev/directory to offer real
college and coaching-centre ids for dev: tokens.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.core import devmode

router = APIRouter()


def _require_dev_mode() -> None:
    if not devmode.is_dev_mode():
        raise HTTPException(status_code=404, detail="Not found")


@router.get("/directory")
async def directory(db: AsyncSession = Depends(get_db)):
    """Colleges and coaching centres to sign in as while developing."""
    _require_dev_mode()
    colleges = await db.execute(
        text(
            "SELECT id, name, slug FROM colleges "
            "WHERE active = true ORDER BY name"
        )
    )
    centres = await db.execute(
        text(
            "SELECT id, name FROM coaching_centers "
            "WHERE active = true ORDER BY name"
        )
    )
    return {
        "colleges": [dict(row._mapping) for row in colleges.fetchall()],
        "coaching_centres": [dict(row._mapping) for row in centres.fetchall()],
    }
