<?php
/**
 * Bootstrap / Orchestrator
 *
 * @package UniverReviews
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Univer_Reviews {

    private static ?self $instance = null;

    private Univer_SaaS_Sync $sync;
    private Univer_Admin $admin;
    private Univer_Shortcode $shortcode;

    // ─── Singleton ────────────────────────────────────────────────────────────

    private function __construct() {
        $this->sync      = new Univer_SaaS_Sync();
        $this->shortcode = new Univer_Shortcode();

        if ( is_admin() ) {
            $this->admin = new Univer_Admin();
        }

        $this->register_hooks();
    }

    public static function get_instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // ─── Hooks ───────────────────────────────────────────────────────────────

    private function register_hooks(): void {
        // Cron: pull reviews from SaaS hourly
        add_action( 'univer_sync_reviews', [ $this->sync, 'pull_reviews' ] );

        // Enqueue widget script on front-end when shortcode is present
        add_action( 'wp_enqueue_scripts', [ $this, 'maybe_enqueue_widget' ] );

        // REST API endpoint for webhook push from SaaS
        add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );

        // Add "Settings" link on plugins page
        add_filter( 'plugin_action_links_' . plugin_basename( UNIVER_PLUGIN_DIR . 'univer-reviews.php' ), [ $this, 'plugin_action_links' ] );
    }

    // ─── Widget Enqueue ───────────────────────────────────────────────────────

    public function maybe_enqueue_widget(): void {
        global $post;

        if ( ! is_singular() || ! isset( $post->post_content ) ) {
            return;
        }

        // Only load widget script if page contains the shortcode
        if ( ! has_shortcode( $post->post_content, 'univer_reviews' ) ) {
            return;
        }

        wp_enqueue_script(
            'univer-reviews-widget',
            UNIVER_WIDGET_CDN,
            [],
            UNIVER_VERSION,
            [ 'strategy' => 'defer', 'in_footer' => true ]
        );
    }

    // ─── REST Routes ──────────────────────────────────────────────────────────

    public function register_rest_routes(): void {
        register_rest_route(
            'univer-reviews/v1',
            '/webhook',
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [ $this, 'handle_webhook' ],
                'permission_callback' => [ $this, 'verify_webhook_signature' ],
            ]
        );
    }

    public function verify_webhook_signature( WP_REST_Request $request ): bool {
        $signature = $request->get_header( 'X-Univer-Signature' );
        $api_key   = get_option( 'univer_api_key', '' );

        if ( empty( $signature ) || empty( $api_key ) ) {
            return false;
        }

        $body     = $request->get_body();
        $expected = 'sha256=' . hash_hmac( 'sha256', $body, $api_key );

        return hash_equals( $expected, $signature );
    }

    public function handle_webhook( WP_REST_Request $request ): WP_REST_Response {
        $payload = $request->get_json_params();
        $event   = $payload['event'] ?? '';

        switch ( $event ) {
            case 'review.approved':
                $this->sync->handle_review_approved( $payload['data'] ?? [] );
                break;
            case 'review.rejected':
                $this->sync->handle_review_rejected( $payload['data'] ?? [] );
                break;
            case 'review.replied':
                $this->sync->handle_review_replied( $payload['data'] ?? [] );
                break;
        }

        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    // ─── Plugin Action Links ───────────────────────────────────────────────────

    public function plugin_action_links( array $links ): array {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            esc_url( admin_url( 'admin.php?page=univer-reviews-settings' ) ),
            __( 'Configurações', 'univer-reviews' )
        );
        array_unshift( $links, $settings_link );
        return $links;
    }
}
