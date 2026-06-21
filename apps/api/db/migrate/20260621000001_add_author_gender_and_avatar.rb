# Adds author gender + optional custom avatar to reviews and questions.
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
# Both columns are nullable + index-free: low-cardinality, never filtered on
# at scale. Backfilling existing rows is unnecessary (nil = current behavior).
class AddAuthorGenderAndAvatar < ActiveRecord::Migration[8.0]
  def change
    add_column :reviews,   :author_gender,     :string
    add_column :reviews,   :author_avatar_url, :string
    add_column :questions, :author_gender,     :string
    add_column :questions, :author_avatar_url, :string
  end
end
