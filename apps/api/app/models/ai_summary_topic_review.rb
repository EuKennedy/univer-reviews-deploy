# Join row linking one review to one AI summary topic. Keeps `position` for
# explicit ordering inside the topic's carousel + `pinned` for an editorial
# "featured first" override.
class AiSummaryTopicReview < ApplicationRecord
  belongs_to :workspace
  belongs_to :ai_summary_topic
  belongs_to :review

  validates :workspace_id,        presence: true
  validates :ai_summary_topic_id, presence: true
  validates :review_id,           presence: true,
                                  uniqueness: { scope: :ai_summary_topic_id }
end
