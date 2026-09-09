from pydantic import BaseModel
from uuid import UUID


class ShortlistAdd(BaseModel):
    college_id: UUID
    course_id: UUID


class ShortlistResponse(BaseModel):
    id: UUID
    college_name: str
    city: str
    state: str
    course_name: str
    stream: str
    application_fee: int
    college_id: UUID
    course_id: UUID