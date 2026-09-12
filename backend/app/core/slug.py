"""Slug generation for colleges.

`colleges.slug` is NOT NULL and UNIQUE. Every writer must supply one, or a
create fails against the constraint. Kept in one place so a new writer cannot
forget it the way the admin create endpoint once did.
"""
import re


def make_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    if not slug:
        raise ValueError("Name does not produce a usable slug")
    return slug


# The only shape make_slug can ever produce. The public landing lookup rejects
# anything else with a 404 rather than teaching callers the grammar.
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def is_valid_slug(value: str) -> bool:
    return len(value) <= 120 and SLUG_RE.match(value) is not None