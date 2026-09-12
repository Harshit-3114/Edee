from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional
import json


def dump_gallery(urls: Optional[List[str]]) -> Optional[str]:
    """Serialise a gallery for the JSONB column. Raw SQL has no ORM type to
    do it, and asyncpg will not adapt a bare list."""
    if urls is None:
        return None
    return json.dumps(urls)


def parse_gallery(value) -> Optional[List[str]]:
    """Inverse of dump_gallery. asyncpg returns JSONB as text, so a read must
    parse before the response goes out or the client gets a doubly-encoded
    string."""
    if value is None:
        return None
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        return None
    return None


def clean_gallery(value: Optional[List[str]]) -> Optional[List[str]]:
    """Trim entries, drop blank lines (the UI edits these as one URL per
    line), and refuse absurdly long URLs rather than storing them."""
    if value is None:
        return None
    cleaned = [item.strip() for item in value if item.strip()]
    for item in cleaned:
        if len(item) > 500:
            raise ValueError("Gallery URLs must be at most 500 characters")
    return cleaned


class CollegeCourseResponse(BaseModel):
    id: UUID
    course_name: str
    stream: str
    duration_years: Optional[int]
    seats: Optional[int]
    application_fee: int


class CollegeResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    location: str
    city: str
    state: str
    type: str
    landing_hero_image_url: Optional[str]
    landing_description: Optional[str]
    landing_gallery_urls: Optional[List[str]]
    courses: List[CollegeCourseResponse] = []