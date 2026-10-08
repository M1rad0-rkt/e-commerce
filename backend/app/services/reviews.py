from app.models import Review
from app.schemas.offer import ReviewOut


def review_out(r: Review, with_offer: bool = False) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        offer_id=r.offer_id,
        offer_title=r.offer.title if with_offer and r.offer else None,
        offer_slug=r.offer.slug if with_offer and r.offer else None,
        user_name=r.user.full_name,
        rating=r.rating,
        comment=r.comment,
        created_at=r.created_at,
    )
