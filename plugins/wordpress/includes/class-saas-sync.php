<?php
/**
 * SaaS Sync — bidirectional review sync between WordPress and UniverReviews API
 *
 * @package UniverReviews
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Univer_SaaS_Sync {

    private string $api_url;
    private string $api_key;
    private string $workspace_id;

    public function __construct() {
        $this->api_url      = get_option( 'univer_api_url', UNIVER_API_URL );
        $this->api_key      = get_option( 'univer_api_key', '' );
        $this->workspace_id = get_option( 'univer_workspace_id', '' );

        // Push: when a new WooCommerce/WP review is posted
        add_action( 'comment_post', [ $this, 'push_review_to_saas' ], 20, 3 );

        // Push: when review status changes (approve/trash/spam)
        add_action( 'wp_set_comment_status', [ $this, 'sync_status_change' ], 20, 2 );

        // Push: when a reply is added to a review
        add_action( 'edit_comment', [ $this, 'maybe_push_reply' ], 20 );
    }

    // ─── Push: new review → SaaS ─────────────────────────────────────────────

    /**
     * @param int    $comment_id       The ID of the new comment
     * @param int    $comment_approved 0 | 1 | 'spam'
     * @param array  $commentdata      Raw comment data
     */
    public function push_review_to_saas( int $comment_id, $comment_approved, array $commentdata ): void {
        if ( ! $this->is_configured() ) {
            return;
        }

        // Only process product reviews
        if ( ! $this->is_product_review( $comment_id ) ) {
            return;
        }

        // Avoid double-push if already synced
        if ( get_comment_meta( $comment_id, '_univer_synced', true ) ) {
            return;
        }

        $comment = get_comment( $comment_id );
        if ( ! $comment ) {
            return;
        }

        $post_id  = (int) $comment->comment_post_ID;
        $product  = $this->get_product_data( $post_id );
        $rating   = $this->get_comment_rating( $comment_id );
        $verified = $this->is_verified_purchaser( $comment->comment_author_email, $post_id );

        $payload = [
            'external_id'         => (string) $comment_id,
            'product_external_id' => (string) $post_id,
            'product_name'        => $product['name'],
            'product_url'         => $product['url'],
            'rating'              => $rating,
            'title'               => '',
            'body'                => wp_strip_all_tags( $comment->comment_content ),
            'author_name'         => $comment->comment_author,
            'author_email'        => $comment->comment_author_email,
            'author_url'          => $comment->comment_author_url,
            'is_verified_purchase'=> $verified,
            'source'              => 'woocommerce',
            'status'              => $comment_approved === 1 ? 'approved' : 'pending',
            'locale'              => get_option( 'univer_widget_locale', 'pt-BR' ),
            'created_at'          => $comment->comment_date_gmt . 'Z',
        ];

        $response = $this->api_request( '/api/v1/wp/sync', 'POST', $payload );

        if ( is_wp_error( $response ) ) {
            $this->log_error( 'push_review_to_saas', $response->get_error_message(), $payload );
            return;
        }

        $status = wp_remote_retrieve_response_code( $response );
        if ( in_array( $status, [ 200, 201, 202 ], true ) ) {
            update_comment_meta( $comment_id, '_univer_synced', true );
            update_comment_meta( $comment_id, '_univer_synced_at', current_time( 'mysql', true ) );

            $body = json_decode( wp_remote_retrieve_body( $response ), true );
            if ( ! empty( $body['review_id'] ) ) {
                update_comment_meta( $comment_id, '_univer_review_id', sanitize_text_field( $body['review_id'] ) );
            }
        }
    }

    // ─── Push: status change → SaaS ──────────────────────────────────────────

    /**
     * @param int    $comment_id
     * @param string $comment_status 'approve' | 'hold' | 'spam' | 'trash'
     */
    public function sync_status_change( int $comment_id, string $comment_status ): void {
        if ( ! $this->is_configured() ) {
            return;
        }

        if ( ! $this->is_product_review( $comment_id ) ) {
            return;
        }

        $univer_review_id = get_comment_meta( $comment_id, '_univer_review_id', true );
        if ( ! $univer_review_id ) {
            return;
        }

        $status_map = [
            'approve' => 'approved',
            'hold'    => 'pending',
            'spam'    => 'rejected',
            'trash'   => 'rejected',
        ];

        $saas_status = $status_map[ $comment_status ] ?? null;
        if ( ! $saas_status ) {
            return;
        }

        $this->api_request(
            sprintf( '/api/v1/wp/reviews/%s/status', $univer_review_id ),
            'PATCH',
            [ 'status' => $saas_status ]
        );
    }

    // ─── Push: reply → SaaS ──────────────────────────────────────────────────

    public function maybe_push_reply( int $comment_id ): void {
        if ( ! $this->is_configured() ) {
            return;
        }

        $comment = get_comment( $comment_id );
        if ( ! $comment || empty( $comment->comment_parent ) ) {
            return;
        }

        $parent_id        = (int) $comment->comment_parent;
        $univer_review_id = get_comment_meta( $parent_id, '_univer_review_id', true );
        if ( ! $univer_review_id ) {
            return;
        }

        $this->api_request(
            sprintf( '/api/v1/wp/reviews/%s/reply', $univer_review_id ),
            'POST',
            [
                'body'        => wp_strip_all_tags( $comment->comment_content ),
                'author_name' => $comment->comment_author ?: get_bloginfo( 'name' ),
            ]
        );
    }

    // ─── Pull: SaaS → WordPress ──────────────────────────────────────────────

    public function pull_reviews(): void {
        if ( ! $this->is_configured() ) {
            return;
        }

        if ( get_option( 'univer_auto_pull', '1' ) !== '1' ) {
            return;
        }

        $since = get_option( 'univer_last_pull_at', '' );
        $url   = '/api/v1/wp/reviews?status=approved&per_page=100';

        if ( $since ) {
            $url .= '&since=' . rawurlencode( $since );
        }

        $response = $this->api_request( $url );
        if ( is_wp_error( $response ) ) {
            $this->log_error( 'pull_reviews', $response->get_error_message() );
            return;
        }

        $status = wp_remote_retrieve_response_code( $response );
        if ( 200 !== $status ) {
            return;
        }

        $data = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( empty( $data['data'] ) || ! is_array( $data['data'] ) ) {
            update_option( 'univer_last_pull_at', gmdate( 'c' ) );
            return;
        }

        foreach ( $data['data'] as $review ) {
            $this->upsert_review_to_wp( $review );
        }

        update_option( 'univer_last_pull_at', gmdate( 'c' ) );
    }

    /**
     * Upsert a review from SaaS into WP comments table.
     *
     * @param array $review
     */
    private function upsert_review_to_wp( array $review ): void {
        if ( empty( $review['id'] ) || empty( $review['product_external_id'] ) ) {
            return;
        }

        $post_id = (int) $review['product_external_id'];
        if ( ! get_post( $post_id ) ) {
            return;
        }

        // Check if already imported by univer_review_id meta
        $existing = $this->find_comment_by_univer_id( $review['id'] );

        $comment_data = [
            'comment_post_ID'      => $post_id,
            'comment_author'       => sanitize_text_field( $review['author_name'] ?? 'Anônimo' ),
            'comment_author_email' => sanitize_email( $review['author_email'] ?? '' ),
            'comment_content'      => sanitize_textarea_field( $review['body'] ?? '' ),
            'comment_approved'     => 1,
            'comment_type'         => 'review',
            'comment_date'         => get_date_from_gmt( $review['created_at'] ?? current_time( 'mysql', true ) ),
            'comment_date_gmt'     => $review['created_at'] ?? current_time( 'mysql', true ),
        ];

        if ( $existing ) {
            $comment_data['comment_ID'] = $existing;
            wp_update_comment( $comment_data );
            $comment_id = $existing;
        } else {
            $comment_id = wp_insert_comment( $comment_data );
        }

        if ( ! $comment_id || is_wp_error( $comment_id ) ) {
            return;
        }

        // Store rating
        if ( ! empty( $review['rating'] ) ) {
            update_comment_meta( $comment_id, 'rating', (int) $review['rating'] );
        }

        update_comment_meta( $comment_id, '_univer_review_id', sanitize_text_field( $review['id'] ) );
        update_comment_meta( $comment_id, '_univer_synced', true );
        update_comment_meta( $comment_id, '_univer_synced_at', current_time( 'mysql', true ) );

        // Add reply if present
        if ( ! empty( $review['reply']['body'] ) ) {
            $this->upsert_reply_to_wp( $comment_id, $review['reply'] );
        }
    }

    private function upsert_reply_to_wp( int $parent_id, array $reply ): void {
        $existing_reply = get_comments( [
            'parent'  => $parent_id,
            'number'  => 1,
            'status'  => 'approve',
            'fields'  => 'ids',
        ] );

        $reply_data = [
            'comment_post_ID'  => (int) get_comment_field( 'comment_post_ID', $parent_id ),
            'comment_parent'   => $parent_id,
            'comment_author'   => sanitize_text_field( $reply['author_name'] ?? get_bloginfo( 'name' ) ),
            'comment_content'  => sanitize_textarea_field( $reply['body'] ),
            'comment_approved' => 1,
        ];

        if ( ! empty( $existing_reply ) ) {
            $reply_data['comment_ID'] = (int) $existing_reply[0];
            wp_update_comment( $reply_data );
        } else {
            wp_insert_comment( $reply_data );
        }
    }

    // ─── Webhook Handlers ─────────────────────────────────────────────────────

    public function handle_review_approved( array $data ): void {
        if ( empty( $data['external_id'] ) ) {
            return;
        }
        $comment_id = (int) $data['external_id'];
        wp_set_comment_status( $comment_id, 'approve' );
    }

    public function handle_review_rejected( array $data ): void {
        if ( empty( $data['external_id'] ) ) {
            return;
        }
        $comment_id = (int) $data['external_id'];
        wp_set_comment_status( $comment_id, 'hold' );
    }

    public function handle_review_replied( array $data ): void {
        if ( empty( $data['external_id'] ) || empty( $data['reply'] ) ) {
            return;
        }
        $comment_id = (int) $data['external_id'];
        if ( get_comment( $comment_id ) ) {
            $this->upsert_reply_to_wp( $comment_id, $data['reply'] );
        }
    }

    // ─── API Request ─────────────────────────────────────────────────────────

    /**
     * @param string          $endpoint Relative API endpoint (e.g. '/api/v1/wp/sync')
     * @param string          $method   HTTP method
     * @param array|null      $data     Request body (will be JSON-encoded)
     * @return array|WP_Error
     */
    private function api_request( string $endpoint, string $method = 'GET', ?array $data = null ) {
        if ( ! $this->is_configured() ) {
            return new WP_Error( 'univer_not_configured', __( 'API key or workspace ID not configured.', 'univer-reviews' ) );
        }

        $url  = rtrim( $this->api_url, '/' ) . $endpoint;
        $args = [
            'method'  => strtoupper( $method ),
            'timeout' => 15,
            'headers' => [
                'Authorization'   => 'Bearer ' . $this->api_key,
                'X-Workspace-ID'  => $this->workspace_id,
                'X-Plugin-Source' => 'wordpress/' . UNIVER_VERSION,
                'Content-Type'    => 'application/json',
                'Accept'          => 'application/json',
            ],
        ];

        if ( $data !== null ) {
            $args['body'] = wp_json_encode( $data );
        }

        return wp_remote_request( $url, $args );
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function is_configured(): bool {
        return ! empty( $this->api_key ) && ! empty( $this->workspace_id );
    }

    private function is_product_review( int $comment_id ): bool {
        $comment = get_comment( $comment_id );
        if ( ! $comment ) {
            return false;
        }

        // WooCommerce: comment type is 'review'
        if ( $comment->comment_type === 'review' ) {
            return true;
        }

        // Generic WP: check if on a product post type
        $post = get_post( (int) $comment->comment_post_ID );
        if ( ! $post ) {
            return false;
        }

        $product_post_types = apply_filters( 'univer_product_post_types', [ 'product', 'post' ] );
        return in_array( $post->post_type, $product_post_types, true );
    }

    private function get_comment_rating( int $comment_id ): int {
        $rating = (int) get_comment_meta( $comment_id, 'rating', true );
        return max( 1, min( 5, $rating ) );
    }

    private function is_verified_purchaser( string $email, int $post_id ): bool {
        if ( ! class_exists( 'WooCommerce' ) || empty( $email ) ) {
            return false;
        }

        $customer = get_user_by( 'email', $email );
        if ( ! $customer ) {
            return false;
        }

        $orders = wc_get_orders( [
            'customer' => $customer->ID,
            'status'   => [ 'completed', 'processing' ],
            'limit'    => -1,
        ] );

        foreach ( $orders as $order ) {
            foreach ( $order->get_items() as $item ) {
                /** @var WC_Order_Item_Product $item */
                if ( method_exists( $item, 'get_product_id' ) && (int) $item->get_product_id() === $post_id ) {
                    return true;
                }
            }
        }

        return false;
    }

    private function get_product_data( int $post_id ): array {
        $post = get_post( $post_id );
        return [
            'name' => $post ? get_the_title( $post ) : '',
            'url'  => $post ? get_permalink( $post ) : '',
        ];
    }

    private function find_comment_by_univer_id( string $univer_id ): ?int {
        global $wpdb;

        $result = $wpdb->get_var( $wpdb->prepare(
            "SELECT comment_id FROM {$wpdb->commentmeta}
             WHERE meta_key = '_univer_review_id' AND meta_value = %s
             LIMIT 1",
            $univer_id
        ) );

        return $result ? (int) $result : null;
    }

    private function log_error( string $context, string $message, array $data = [] ): void {
        if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
            error_log( sprintf(
                '[UniverReviews][%s] %s | data: %s',
                $context,
                $message,
                wp_json_encode( $data )
            ) );
        }
    }
}
