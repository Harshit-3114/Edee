from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.connection import get_db
from app.middleware.auth import get_current_user
from app.core.rate_limit import limited
from app.core.slug import is_valid_slug
from app.models.college import parse_gallery
from typing import Any, Literal, Optional
from uuid import UUID

router = APIRouter()


def _with_gallery(row: Any) -> dict:
    row = dict(row)
    row["landing_gallery_urls"] = parse_gallery(row.get("landing_gallery_urls"))
    return row


@router.get("/")
@limited("60/minute")
async def list_colleges(
    request: Request,
    # Literal rather than str: an unconstrained value reaches the query planner
    # and shows up in logs, and "UG or PG" in a docstring is not a check.
    stream: Optional[Literal["UG", "PG"]] = Query(None),
    state: Optional[str] = Query(None, max_length=64),
    type: Optional[Literal["private", "government", "deemed"]] = Query(None),
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Colleges with their open courses nested, newest filter wins.

    Public, like the landing pages: college discovery is top-of-funnel, and
    this carries no personal data, so there is nothing to scope. A modest
    rate limit applies because anonymous callers are the cheapest to abuse.

    Fees are returned in **paise**. They are stored in rupees, and converting
    at the edge keeps one unit in every response and in the payment flow.
    """
    conditions = ["c.active = true"]
    params: dict = {"limit": limit, "offset": offset}

    # The fragments below are literals chosen by this function. Only values are
    # ever bound from input, so the f-string cannot be steered by a caller.
    if stream:
        conditions.append("cc.stream = :stream")
        params["stream"] = stream
    if state:
        conditions.append("c.state = :state")
        params["state"] = state
    if type:
        conditions.append("c.type = :type")
        params["type"] = type
    if search:
        conditions.append("c.name ILIKE :search")
        # Escape the LIKE wildcards a user can type, so "100%" is not a
        # full-table scan wearing a disguise.
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["search"] = f"%{escaped}%"

    where = " AND ".join(conditions)

    # Paginate over colleges, not over the college-course join: with LIMIT on
    # the joined rows a college offering 20 courses fills the page by itself.
    result = await db.execute(
        text(
            f"""
            WITH page AS (
                SELECT DISTINCT c.id, c.name
                FROM colleges c
                JOIN college_courses cc
                  ON cc.college_id = c.id AND cc.active = true
                WHERE {where}
                ORDER BY c.name
                LIMIT :limit OFFSET :offset
            )
            SELECT c.id,
                   c.name,
                   c.slug,
                   c.location,
                   c.city,
                   c.state,
                   c.type,
                   c.active,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', cc.id,
                               'college_id', c.id,
                               'course_name', cc.course_name,
                               'stream', cc.stream,
                               'duration_years', cc.duration_years,
                               'seats', cc.seats,
                                'application_fee', cc.application_fee * 100,
                                'active', cc.active,
                                'closing_date', cc.closing_date
                           )
                           ORDER BY cc.course_name
                       ) FILTER (WHERE cc.id IS NOT NULL),
                       '[]'
                   ) AS courses
            FROM page
            JOIN colleges c ON c.id = page.id
            LEFT JOIN college_courses cc
                   ON cc.college_id = c.id AND cc.active = true
            GROUP BY c.id, c.name, c.slug, c.location, c.city, c.state, c.type, c.active
            ORDER BY c.name
            """
        ),
        params,
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/{college_id}")
async def get_college(
    # Typed as UUID so a malformed id is a 422 from the framework rather than a
    # database error surfacing as a 500.
    college_id: UUID,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT c.id,
                   c.name,
                   c.slug,
                   c.location,
                   c.city,
                   c.state,
                   c.type,
                   c.active,
                   c.landing_hero_image_url,
                   c.landing_description,
                   c.landing_gallery_urls,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', cc.id,
                               'college_id', c.id,
                               'course_name', cc.course_name,
                               'stream', cc.stream,
                               'duration_years', cc.duration_years,
                               'seats', cc.seats,
                                'application_fee', cc.application_fee * 100,
                                'active', cc.active,
                                'closing_date', cc.closing_date
                           )
                           ORDER BY cc.course_name
                       ) FILTER (WHERE cc.id IS NOT NULL),
                       '[]'
                   ) AS courses
            FROM colleges c
            LEFT JOIN college_courses cc
                   ON cc.college_id = c.id AND cc.active = true
            WHERE c.id = :college_id AND c.active = true
            GROUP BY c.id
            """
        ),
        {"college_id": college_id},
    )

    row = result.fetchone()
    if not row:
        # HTTPException was not imported before, so this line raised NameError
        # and every missing college came back as a 500 with a stack trace.
        raise HTTPException(status_code=404, detail="College not found")
    return _with_gallery(row._mapping)


@router.get("/by-slug/{slug}")
@limited("60/minute")
async def get_college_by_slug(
    request: Request,
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public landing-page lookup: no token required, by design.

    This is the top-of-funnel page students reach from search or a shared
    link, so demanding a login here would strangle admissions. It carries no
    personal data — only the college's own public listing — and hidden
    (inactive) colleges 404 exactly like unknown slugs, so the endpoint never
    confirms whether a hidden college exists. A modest rate limit applies
    because anonymous callers are the cheapest to abuse.
    """
    # 404, not 422, for a malformed slug: the grammar of slugs is not
    # something an anonymous caller needs to learn by probing.
    if not is_valid_slug(slug):
        raise HTTPException(status_code=404, detail="College not found")

    result = await db.execute(
        text(
            """
            SELECT c.id,
                   c.name,
                   c.slug,
                   c.location,
                   c.city,
                   c.state,
                   c.type,
                   c.landing_hero_image_url,
                   c.landing_description,
                   c.landing_gallery_urls,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', cc.id,
                               'college_id', c.id,
                               'course_name', cc.course_name,
                               'stream', cc.stream,
                               'duration_years', cc.duration_years,
                               'seats', cc.seats,
                                'application_fee', cc.application_fee * 100,
                                'active', cc.active,
                                'closing_date', cc.closing_date
                           )
                           ORDER BY cc.course_name
                       ) FILTER (WHERE cc.id IS NOT NULL),
                       '[]'
                   ) AS courses
            FROM colleges c
            LEFT JOIN college_courses cc
                   ON cc.college_id = c.id AND cc.active = true
            WHERE c.slug = :slug AND c.active = true
            GROUP BY c.id
            """
        ),
        {"slug": slug},
    )

    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="College not found")
    return _with_gallery(row._mapping)
