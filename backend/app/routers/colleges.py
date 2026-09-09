from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from typing import Optional

router = APIRouter()


@router.get("/")
async def list_colleges(
    stream: Optional[str] = Query(None, description="UG or PG"),
    state: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["c.active = true"]
    params = {"limit": limit, "offset": offset}

    if stream:
        conditions.append("cc.stream = :stream")
        params["stream"] = stream
    if state:
        conditions.append("c.state = :state")
        params["state"] = state
    if search:
        conditions.append("c.name ILIKE :search")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)

    result = await db.execute(text(f"""
        SELECT
            c.id           AS college_id,
            c.name         AS college_name,
            c.city,
            c.state,
            c.type,
            cc.id          AS course_id,
            cc.course_name,
            cc.stream,
            cc.seats,
            cc.application_fee
        FROM colleges c
        JOIN college_courses cc ON cc.college_id = c.id AND cc.active = true
        WHERE {where}
        ORDER BY c.name, cc.course_name
        LIMIT :limit OFFSET :offset
    """), params)

    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


@router.get("/{college_id}")
async def get_college(
    college_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT c.*, 
               json_agg(json_build_object(
                   'id', cc.id,
                   'course_name', cc.course_name,
                   'stream', cc.stream,
                   'duration_years', cc.duration_years,
                   'seats', cc.seats,
                   'application_fee', cc.application_fee
               )) as courses
        FROM colleges c
        LEFT JOIN college_courses cc ON cc.college_id = c.id AND cc.active = true
        WHERE c.id = :college_id
        GROUP BY c.id
    """), {"college_id": college_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="College not found")
    return dict(row._mapping)