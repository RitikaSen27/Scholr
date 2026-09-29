"""add report_count, is_removed to notes and create note_reports table

Revision ID: 001_add_report_fields
Revises: 
Create Date: 2026-09-29

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "001_add_report_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables are created by Base.metadata.create_all() at app startup.
    # Skip everything if the schema is missing or already up to date.
    inspector = sa.inspect(op.get_bind())
    if "notes" not in inspector.get_table_names():
        return
    if "note_reports" in inspector.get_table_names():
        return

    # Add new columns to notes
    existing = [c["name"] for c in inspector.get_columns("notes")]
    if "report_count" not in existing:
        op.add_column("notes", sa.Column("report_count", sa.Integer(), nullable=False, server_default="0"))
    if "is_removed" not in existing:
        op.add_column("notes", sa.Column("is_removed", sa.Boolean(), nullable=False, server_default="false"))

    # Create note_reports table
    op.create_table(
        "note_reports",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_unique_constraint("uq_note_report_user", "note_reports", ["note_id", "user_id"])


def downgrade() -> None:
    op.drop_table("note_reports")
    op.drop_column("notes", "is_removed")
    op.drop_column("notes", "report_count")
