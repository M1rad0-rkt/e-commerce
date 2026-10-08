import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    if not text:
        text = "offre"
    # Un slug purement numérique serait confondu avec un identifiant dans /offers/{id_ou_slug}.
    if text.isdigit():
        text = f"o-{text}"
    return text[:200]


def unique_slug(db: Session, model, base: str, exclude_id: int | None = None) -> str:
    slug = slugify(base)
    candidate, n = slug, 2
    while True:
        stmt = select(model.id).where(model.slug == candidate)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.scalar(stmt) is None:
            return candidate
        candidate = f"{slug}-{n}"
        n += 1
