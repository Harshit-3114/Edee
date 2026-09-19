"""
Bulk-lead files: templates, parsing, and interest resolution.

Coaching institutes send students in bulk. The file shape is fixed -
name, email, phone, stream, plus an optional `shortlisted` column naming
"College :: Course" pairs separated by semicolons. Leads are not students
yet, so interests are stored verbatim on the lead and resolved into real
shortlist rows when the lead registers with the issuing centre's invite
code. Anything that does not resolve is left out silently: a lead must
never fail to register because a college renamed a course.
"""
import csv
import io
import logging
import uuid
from typing import Optional

from fastapi import HTTPException
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

REQUIRED_HEADERS = {"name", "email", "phone", "stream"}
SHORTLISTED_HEADER = "shortlisted"
MAX_INTERESTS_CHARS = 2000
MAX_APPLIED_SHORTLISTS = 25

EXAMPLE_SHORTLISTED = "Fergusson College :: B.Sc Statistics; Christ University :: BBA"


def build_template_xlsx() -> bytes:
    """The file institutes fill in: headers, widths, and two filled rows so
    the shape - including the shortlisted column - is visible in the file."""
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "Students"
    headers = ["name", "email", "phone", "stream", "shortlisted"]
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    sheet.append(
        ["Aarav Sharma", "aarav@example.com", "9876543210", "UG", EXAMPLE_SHORTLISTED]
    )
    sheet.append(["Diya Patel", "diya@example.com", "9876543211", "PG", ""])
    widths = {"A": 20, "B": 26, "C": 14, "D": 10, "E": 64}
    for column, width in widths.items():
        sheet.column_dimensions[column].width = width
    sheet.freeze_panes = "A2"
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def read_rows(filename: str, raw: bytes) -> list:
    """
    Parse an uploaded file into (line number, row dict) pairs with
    lowercased, stripped headers. Accepts .csv and .xlsx: Excel is what
    institutes actually have, CSV is what everything else produces.
    """
    name = (filename or "").lower()
    if name.endswith(".csv"):
        try:
            content = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Upload a CSV file saved as UTF-8.")
        try:
            reader = csv.DictReader(io.StringIO(content))
            headers = {(h or "").strip().lower() for h in (reader.fieldnames or [])}
            rows = list(reader)
        except csv.Error:
            raise HTTPException(status_code=400, detail="Could not parse that CSV file.")
    elif name.endswith((".xlsx", ".xlsm")):
        try:
            workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            sheet = workbook.active
            assert sheet is not None
            grid = list(sheet.iter_rows(values_only=True))
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Could not parse that Excel file.")
        if not grid:
            raise HTTPException(status_code=422, detail="The file has no rows.")
        header_row = [( "" if h is None else str(h)) for h in (grid[0] or [])]
        headers = {h.strip().lower() for h in header_row}
        rows = []
        for row in grid[1:]:
            values = [("" if v is None else str(v)) for v in (row or [])]
            if not any(v.strip() for v in values):
                continue
            rows.append(
                {h.strip().lower(): v for h, v in zip(header_row, values)}
            )
    else:
        raise HTTPException(
            status_code=422, detail="Upload a .csv or .xlsx file."
        )

    if not REQUIRED_HEADERS.issubset(headers):
        raise HTTPException(
            status_code=422,
            detail="The file needs name, email, phone and stream columns. "
            "Download the template to see the shape.",
        )
    if not rows:
        raise HTTPException(status_code=422, detail="The file has no student rows.")
    return list(enumerate(rows, start=2))


def parse_interests(raw: Optional[str]) -> list:
    """
    "College :: Course; College :: Course" into (college, course) pairs.
    A single "|" works as the pair separator too, for files typed by hand.
    """
    if not raw:
        return []
    pairs = []
    for chunk in raw.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        for separator in ("::", "|"):
            if separator in chunk:
                college, _, course = chunk.partition(separator)
                college, course = college.strip(), course.strip()
                if college and course:
                    pairs.append((college, course))
                break
    return pairs


async def apply_interests(db: AsyncSession, student_id, interests: Optional[str]) -> int:
    """
    Turn a lead's stored interests into shortlist rows. Best effort by
    contract: unknown colleges, closed courses and duplicates are skipped,
    never errors. Returns how many rows were created.
    """
    pairs = parse_interests(interests)[:MAX_APPLIED_SHORTLISTS]
    if not pairs:
        return 0

    result = await db.execute(
        text(
            """
            SELECT c.name AS college_name, cc.id AS course_id,
                   cc.college_id, cc.course_name
            FROM college_courses cc
            JOIN colleges c ON c.id = cc.college_id
            WHERE cc.active = true AND c.active = true
              AND (cc.closing_date IS NULL OR cc.closing_date > now())
            """
        )
    )
    catalogue = {
        (row.college_name.strip().lower(), row.course_name.strip().lower()): (
            row.college_id,
            row.course_id,
        )
        for row in result.fetchall()
    }

    created = 0
    for college, course in pairs:
        match = catalogue.get((college.lower(), course.lower()))
        if not match:
            continue
        college_id, course_id = match
        inserted = await db.execute(
            text(
                """
                INSERT INTO shortlists (id, student_id, college_id, course_id)
                VALUES (:id, :student_id, :college_id, :course_id)
                ON CONFLICT (student_id, college_id, course_id) DO NOTHING
                RETURNING id
                """
            ),
            {
                "id": uuid.uuid4(),
                "student_id": student_id,
                "college_id": college_id,
                "course_id": course_id,
            },
        )
        if inserted.fetchone():
            created += 1
    return created
