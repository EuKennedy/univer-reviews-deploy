require "rails_helper"

# CRITICAL: this spec is the only proof we have that workspace A cannot
# read workspace B's data via raw queries. The application layer scopes
# queries with `current_workspace.X` but if RLS ever degrades (missing
# policy, FORCE OFF, session-level SET instead of LOCAL, etc.) every
# query becomes a privilege boundary leak.
#
# We DO NOT stub set_rls_workspace here. We exercise the real PostgreSQL
# row_security policies created in the initial_schema migration + the
# follow-up migrations for ai_summary_topics, question_groups, etc.
#
# When this spec fails, do NOT change the assertions to "fix" it.
# Investigate which table lost its policy.
RSpec.describe "Row-Level Security · cross-tenant isolation", type: :model do
  # The DB user used in CI (`postgres`) is the table owner. PostgreSQL
  # historically lets table owners bypass RLS unless FORCE ROW LEVEL
  # SECURITY is set. Every workspace-scoped table in this app uses FORCE,
  # so this test verifies that contract on the actual schema, not in a
  # mock. If the assertion fails it means a migration forgot the FORCE
  # clause and the SECURITY DEFINER / owner bypass is back.

  let!(:workspace_a) { create(:workspace, slug: "rls-a") }
  let!(:workspace_b) { create(:workspace, slug: "rls-b") }

  let!(:product_a) { create(:product, workspace: workspace_a, title: "Product A") }
  let!(:product_b) { create(:product, workspace: workspace_b, title: "Product B") }

  let!(:review_a) do
    create(:review, :approved, workspace: workspace_a, product: product_a, body: "owned by A").tap do |r|
      # Approval timestamp is irrelevant; we just need a row tied to A.
    end
  end

  let!(:review_b) do
    create(:review, :approved, workspace: workspace_b, product: product_b, body: "owned by B")
  end

  def with_workspace_rls(workspace_id)
    # Real RLS contract: SET LOCAL inside a transaction + force
    # row_security back on. Same path the controllers take.
    ActiveRecord::Base.transaction(requires_new: true) do
      ActiveRecord::Base.connection.execute(
        ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_id.to_s])
      )
      ActiveRecord::Base.connection.execute("SET LOCAL row_security = on")
      yield
      raise ActiveRecord::Rollback # discard mutations, keep test isolated
    end
  end

  describe "Review" do
    it "scope A only sees A's review when RLS is set to A" do
      with_workspace_rls(workspace_a.id) do
        ids = Review.pluck(:id)
        expect(ids).to     include(review_a.id)
        expect(ids).not_to include(review_b.id)
      end
    end

    it "scope B only sees B's review when RLS is set to B" do
      with_workspace_rls(workspace_b.id) do
        ids = Review.pluck(:id)
        expect(ids).to     include(review_b.id)
        expect(ids).not_to include(review_a.id)
      end
    end

    it "raw find on the other tenant's id returns nothing (RecordNotFound)" do
      with_workspace_rls(workspace_a.id) do
        expect { Review.find(review_b.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end

  describe "Product" do
    it "is isolated per workspace" do
      with_workspace_rls(workspace_a.id) do
        expect(Product.pluck(:id)).to eq([product_a.id])
      end
      with_workspace_rls(workspace_b.id) do
        expect(Product.pluck(:id)).to eq([product_b.id])
      end
    end
  end

  describe "AiSummaryTopic" do
    let!(:topic_a) { create(:ai_summary_topic, workspace: workspace_a, product: product_a, title: "A topic", position: 0) }
    let!(:topic_b) { create(:ai_summary_topic, workspace: workspace_b, product: product_b, title: "B topic", position: 0) }

    it "is isolated per workspace" do
      with_workspace_rls(workspace_a.id) do
        expect(AiSummaryTopic.pluck(:id)).to eq([topic_a.id])
      end
      with_workspace_rls(workspace_b.id) do
        expect(AiSummaryTopic.pluck(:id)).to eq([topic_b.id])
      end
    end

    it "cannot be updated via the wrong workspace" do
      with_workspace_rls(workspace_a.id) do
        # update_all should affect 0 rows for B's topic, not raise.
        affected = AiSummaryTopic.where(id: topic_b.id).update_all(title: "HIJACKED")
        expect(affected).to eq(0)
      end
      # Confirm topic_b is unchanged.
      expect(topic_b.reload.title).to eq("B topic")
    end
  end

  describe "no RLS context set" do
    it "every workspace-scoped table is empty when app.workspace_id is unset" do
      # FORCE ROW LEVEL SECURITY means even the table owner can't bypass
      # the policy. Without a workspace context the USING clause
      # (workspace_id = current_setting('app.workspace_id', true)::uuid)
      # returns NULL → row excluded.
      ActiveRecord::Base.transaction(requires_new: true) do
        ActiveRecord::Base.connection.execute("RESET app.workspace_id")
        ActiveRecord::Base.connection.execute("SET LOCAL row_security = on")
        expect(Review.count).to  eq(0)
        expect(Product.count).to eq(0)
        raise ActiveRecord::Rollback
      end
    end
  end

  describe "workspace metadata table itself" do
    # The `workspaces` table is intentionally NOT RLS-scoped (it has no
    # workspace_id column — it IS the workspace). This test exists so
    # someone adding RLS to `workspaces` by mistake will see the contract
    # break here instead of in production.
    it "remains globally readable" do
      with_workspace_rls(workspace_a.id) do
        expect(Workspace.where(id: [workspace_a.id, workspace_b.id]).count).to eq(2)
      end
    end
  end
end
