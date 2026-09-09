from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional


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