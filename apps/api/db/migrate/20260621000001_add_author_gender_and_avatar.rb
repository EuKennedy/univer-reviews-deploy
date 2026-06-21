# Adds author gender + optional custom avatar to reviews and questions, and
# widens the status CHECK constraints to allow the new `draft` status.
#
#   author_gender      — "female" | "male" | nil. Drives gender-consistent
#                        name generation for AI drafts (fixes the "nome
#                        masculino + sexo feminino" mismatch) and lets the
#                        operator correct it in the draft editor.
#   author_avatar_url  — optional custom profile photo uploaded by the
#                        operator. When nil the storefront falls back to the
#                        deterministic initials+color avatar. We deliberately
#                        do NOT auto-generate photorealistic faces (misleading
#                        consumers about real people = CDC/LGPD risk).
#
# The initial schema pinned status to a fixed enum via a DB CHECK constraint
# (reviews: pending/approved/rejected/hidden/spam; questions: pending/
# published/rejected). AI bulk-generation now lands rows as `draft`, so the
# constraints must include it — otherwise every draft INSERT/UPDATE raises a
# CheckViolation that aborts the request transaction.
class AddAuthorGenderAndAvatar < ActiveRecord::Migration[8.0]
  def up
    add_column :reviews,   :author_gender,     :string
    add_column :reviews,   :author_avatar_url, :string
    add_column :questions, :author_gender,     :string
    add_column :questions, :author_avatar_url, :string

    execute "ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check"
    execute <<~SQL
      ALTER TABLE reviews ADD CONSTRAINT reviews_status_check
        CHECK (status IN ('draft','pending','approved','rejected','hidden','spam'))
    SQL

    execute "ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check"
    execute <<~SQL
      ALTER TABLE questions ADD CONSTRAINT questions_status_check
        CHECK (status IN ('draft','pending','published','rejected'))
    SQL
  end

  def down
    execute "ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check"
    execute <<~SQL
      ALTER TABLE reviews ADD CONSTRAINT reviews_status_check
        CHECK (status IN ('pending','approved','rejected','hidden','spam'))
    SQL

    execute "ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check"
    execute <<~SQL
      ALTER TABLE questions ADD CONSTRAINT questions_status_check
        CHECK (status IN ('pending','published','rejected'))
    SQL

    remove_column :questions, :author_avatar_url
    remove_column :questions, :author_gender
    remove_column :reviews,   :author_avatar_url
    remove_column :reviews,   :author_gender
  end
end
