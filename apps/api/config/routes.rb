Rails.application.routes.draw do
  # Health
  get "/", to: "application#root"
  get "/health", to: "application#health"

  namespace :api do
    namespace :v1 do
      # Auth
      post "auth/login",      to: "auth#login"
      post "auth/magic-link", to: "auth#magic_link"
      # POST + body. The old GET route is preserved short-term for clients
      # that still send the token via query string — both call the same
      # action so the response is identical. Schedule removal once the
      # Next.js verify page is fully POSTified.
      post "auth/verify",     to: "auth#verify"
      get  "auth/verify",     to: "auth#verify"
      delete "auth/logout",   to: "auth#logout"

      # Reviews (authenticated staff)
      resources :reviews, only: %i[index show create destroy] do
        collection do
          post :bulk
          post :bulk_import, action: :bulk_import, path: "bulk_import"
          get  "export.csv", action: :export, as: :export_csv
        end
        member do
          post :status
          post :attach_media
        end
      end

      # Replies
      resources :reviews do
        resources :replies, only: %i[create update destroy], shallow: true
      end

      # AI
      namespace :ai do
        get  :health
        post :moderate
        post :generate
        post "generate-variants",     action: :generate_variants
        post "bulk-create-reviews",       action: :bulk_create_reviews
        post "bulk-create-questions",     action: :bulk_create_questions
        post "bulk-create-questions-all", action: :bulk_create_questions_all
        post :reply
        post "auto-reply", action: :auto_reply
        get  :duplicates
        get  "duplicate-clusters", action: :duplicate_clusters
        post :dedup
        post "cleanup-duplicates", action: :cleanup_duplicates
        post :embed
        post "embed-batch", action: :embed_batch
        post "find-similar", action: :find_similar
      end

      # Workspace
      resource :workspace, controller: "workspace", only: %i[show update] do
        get :stats
        resources :users, controller: "workspace_users", only: %i[index create update destroy]
        resources :api_keys, controller: "workspace_api_keys", only: %i[index create destroy], path: "api_keys"
        # Hyphen alias so callers using /api-keys keep working.
        resources :api_keys, controller: "workspace_api_keys", only: %i[index create destroy], path: "api-keys", as: :api_keys_hyphen
        resources :domains, controller: "workspace_domains", only: %i[index create destroy]
      end

      # Products
      resources :products, only: %i[index show create update destroy] do
        collection do
          post :sync
        end
      end

      # Catalog health
      get "catalog-health",            to: "catalog_health#index"
      get "catalog-health/by-product", to: "catalog_health#by_product"

      # Campaigns
      resources :campaigns do
        member do
          post :send_now
          post :pause
          post :resume
          post :test_send
        end
      end

      # Email tracking (no auth — payload is signed)
      get "email/open",  to: "tracking#open"
      get "email/click", to: "tracking#click"

      # Rewards
      resources :reward_rules
      resources :reward_grants, only: %i[index show]

      # Imports
      namespace :import do
        post :bulk
        post :ryviu
        post :woocommerce
        post :judge_me,   path: "judge-me"
        post :yotpo
        post :loox
        post :stamped
        post :reviews_io, path: "reviews-io"
      end

      # Q&A (questions)
      resources :questions, only: %i[index show update destroy] do
        member do
          post :helpful
        end
        collection do
          post :bulk_import, action: :bulk_import, path: "bulk_import"
        end
      end

      # Q&A groups (admin)
      resources :question_groups, only: %i[index show create update destroy] do
        member do
          post :attach_products
          post :detach_products
        end
      end

      # Product groups (admin) — share reviews across product variations.
      resources :product_groups, only: %i[index show create update destroy] do
        member do
          post :attach_products
          post :detach_products
        end
      end

      # Integrations
      namespace :integrations do
        resource :woocommerce, controller: "woocommerce", only: %i[show create update destroy] do
          post :test
          post :sync_products
          post :sync_reviews
        end
      end

      # Billing
      resource :billing, controller: "billing", only: [:show] do
        post :create_checkout
        post :portal
      end

      # Audit log
      resources :audit_logs, only: [:index]

      # WordPress sync. The PHP plugin pushes status changes and replies via
      # /api/v1/wp/reviews/:id/{status,reply} — these mirror the standard
      # /reviews/:id/status and /reviews/:id/replies endpoints but live under
      # the wp namespace so the plugin codepath is self-contained.
      namespace :wp do
        post :sync
        get  :ping,    to: "sync#ping"
        get  :reviews, to: "sync#reviews"
        patch "reviews/:id/status", to: "sync#update_status"
        post  "reviews/:id/reply",  to: "sync#add_reply"

        # Univer Loyalty plugin → SaaS dashboard mirror.
        put    "loyalty/sync",                     to: "loyalty#sync"
        delete "loyalty/:source_campaign_id",      to: "loyalty#destroy"
      end

      # Loyalty config (read-only, surfaced in dashboard).
      get "loyalty", to: "loyalty#index"

      # Public (no auth) - storefront/widget
      namespace :public do
        get  "reviews/:product_id",     to: "reviews#index"
        get  "summary/:product_id",     to: "reviews#summary"
        get  "ai-carousel/:product_id", to: "reviews#ai_carousel"
        get  "featured",                to: "reviews#featured"
        post "submit",                  to: "reviews#submit"
        post "reviews/:id/helpful",     to: "reviews#helpful"
        post "reviews/:id/unhelpful",   to: "reviews#unhelpful"
        get  "questions/:product_id",   to: "questions#index"
        post "questions/:product_id",   to: "questions#create"
        get  "videos/:product_id",      to: "videos#index"
        get  "widget-config",           to: "widget_config#show"
      end

      # Webhooks — each sub-controller exposes a `create` action.
      # Without explicit `to:` mappings, `post :woocommerce` resolves to
      # WebhooksController#woocommerce, which does not exist (we use one
      # controller per integration).
      namespace :webhooks do
        post "woocommerce", to: "woocommerce#create"
        post "shopify",     to: "shopify#create"
        post "stripe",      to: "stripe#create"
        post "feedspace",   to: "feedspace#create"
        post "resend",      to: "resend#create"
      end
    end
  end

  # Widget JS bundle
  get "/widget.js", to: "widget#serve"
end
