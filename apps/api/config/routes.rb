Rails.application.routes.draw do
  # Health
  get "/", to: "application#root"
  get "/health", to: "application#health"

  namespace :api do
    namespace :v1 do
      # Auth
      post "auth/magic-link", to: "auth#magic_link"
      get  "auth/verify",     to: "auth#verify"
      delete "auth/logout",   to: "auth#logout"

      # Reviews (authenticated staff)
      resources :reviews, only: %i[index show create destroy] do
        collection do
          post :bulk
        end
        member do
          post :status
        end
      end

      # Replies
      resources :reviews do
        resources :replies, only: %i[create update destroy], shallow: true
      end

      # AI
      namespace :ai do
        post :moderate
        post :generate
        post "generate-variants", action: :generate_variants
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
      resource :workspace, only: %i[show update] do
        get :stats
        resources :users, controller: "workspace_users", only: %i[index create update destroy]
        resources :api_keys, controller: "workspace_api_keys", only: %i[index create destroy]
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
        end
      end

      # Rewards
      resources :reward_rules
      resources :reward_grants, only: %i[index show]

      # Imports
      namespace :import do
        post :bulk
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
      end

      # Integrations
      namespace :integrations do
        resource :woocommerce, only: %i[show create update destroy] do
          post :test
          post :sync_products
          post :sync_reviews
        end
      end

      # Billing
      resource :billing, only: [:show] do
        post :create_checkout
        post :portal
      end

      # Audit log
      resources :audit_logs, only: [:index]

      # WordPress sync
      namespace :wp do
        post :sync
      end

      # Public (no auth) - storefront/widget
      namespace :public do
        get  "reviews/:product_id",    to: "reviews#index"
        get  "summary/:product_id",    to: "reviews#summary"
        post "submit",                 to: "reviews#submit"
        get  "questions/:product_id",  to: "questions#index"
        post "questions/:product_id",  to: "questions#create"
        get  "videos/:product_id",     to: "videos#index"
      end

      # Webhooks
      namespace :webhooks do
        post :woocommerce
        post :shopify
        post :stripe
        post :feedspace
      end
    end
  end

  # Widget JS bundle
  get "/widget.js", to: "widget#serve"
end
