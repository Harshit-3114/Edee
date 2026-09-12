from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class ShortlistAdd(BaseModel):
    college_id: UUID
    course_id: UUID


class ShortlistResponse(BaseModel):
    # `id`, not `shortlist_id`: this is what create-order takes back as
    # shortlist_ids, and what the client keys its list on.
    id: UUID
    college_id: UUID
    course_id: UUID
    college_name: str
    city: str
    state: str
    course_name: str
    stream: str
    application_fee: int  # paise
    closing_date: Optional[datetime] = None
    created_at: datetime
