import logging
from datetime import datetime, timezone
from typing import List

from sqlalchemy.orm import Session

from app import models
from app.models import BadgeType

logger = logging.getLogger(__name__)

# Upload-count thresholds
BADGE_THRESHOLDS = {
    BadgeType.BEGINNER: 5,
    BadgeType.INTERMEDIATE: 50,
}
# Streak threshold for SOPHISTICATED
SOPHISTICATED_STREAK = 100


def _has_badge(user: models.User, badge_type: BadgeType) -> bool:
    return any(b.badge_type == badge_type for b in user.badges)


def check_and_award_badges(user: models.User, db: Session) -> List[models.Badge]:
    """
    Evaluate badge criteria after an upload.
    Returns a list of newly awarded Badge records.
    """
    new_badges: List[models.Badge] = []

    # Upload-count based badges
    for badge_type, threshold in BADGE_THRESHOLDS.items():
        if user.total_uploads >= threshold and not _has_badge(user, badge_type):
            badge = models.Badge(
                user_id=user.id,
                badge_type=badge_type,
                unlocked_at=datetime.now(timezone.utc),
            )
            db.add(badge)
            user.badges.append(badge)
            new_badges.append(badge)
            logger.info("Awarded %s badge to user %s", badge_type, user.id)

    # Streak-based SOPHISTICATED badge
    if (
        user.current_streak >= SOPHISTICATED_STREAK
        and not _has_badge(user, BadgeType.SOPHISTICATED)
    ):
        badge = models.Badge(
            user_id=user.id,
            badge_type=BadgeType.SOPHISTICATED,
            unlocked_at=datetime.now(timezone.utc),
        )
        db.add(badge)
        user.badges.append(badge)
        new_badges.append(badge)
        logger.info("Awarded SOPHISTICATED badge to user %s", user.id)

    return new_badges
