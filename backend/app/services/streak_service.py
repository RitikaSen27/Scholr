from datetime import date, timedelta
import logging

from sqlalchemy.orm import Session

from app import models

logger = logging.getLogger(__name__)


def update_streak(user: models.User, db: Session) -> int:
    """
    Compare today's date with last_upload_date.
    - Same day  → no change (already counted today).
    - Yesterday → increment streak.
    - Older or None → reset to 1 (first upload today).
    Returns the new (or unchanged) streak value.
    """
    today = date.today()
    last = user.last_upload_date

    if last == today:
        # Already uploaded today; streak stays the same
        return user.current_streak

    if last == today - timedelta(days=1):
        # Consecutive day upload
        user.current_streak += 1
        logger.info("User %s streak incremented to %d", user.id, user.current_streak)
    else:
        # Gap in uploads — reset
        user.current_streak = 1
        logger.info("User %s streak reset to 1", user.id)

    user.last_upload_date = today
    db.add(user)
    return user.current_streak
