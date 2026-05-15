<?php
/**
 * Shortcode: [univer_reviews product_id="123"]
 *
 * @package UniverReviews
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Univer_Shortcode {

    public function __construct() {
        add_shortcode( 'univer_reviews', [ $this, 'render' ] );

        // Also support Gutenberg block as a classic shortcode wrapper
        add_action( 'init', [ $this, 'register_block' ] );
    }

    /**
     * Render the [univer_reviews] shortcode.
     *
     * @param array       $atts    Shortcode attributes
     * @param string|null $content Inner content (unused)
     * @return string             HTML output
     */
    public function render( array|string $atts, ?string $content = null ): string {
        $atts = shortcode_atts(
            [
                'product_id'        => '',
                'workspace_id'      => get_option( 'univer_workspace_id', '' ),
                'layout'            => get_option( 'univer_widget_layout', 'default' ),
                'locale'            => get_option( 'univer_widget_locale', 'pt-BR' ),
                'theme_color'       => get_option( 'univer_widget_theme_color', '#d4a850' ),
                'show_qa'           => 'true',
                'show_write_review' => 'true',
                'api_url'           => get_option( 'univer_api_url', UNIVER_API_URL ),
                'class'             => '',
            ],
            $atts,
            'univer_reviews'
        );

        // Resolve product_id: use shortcode attr, fall back to current WooCommerce product
        $product_id = sanitize_text_field( $atts['product_id'] );
        if ( empty( $product_id ) ) {
            $product_id = $this->get_current_product_id();
        }

        if ( empty( $product_id ) ) {
            if ( current_user_can( 'edit_posts' ) ) {
                return '<p style="color:#e53e3e;font-size:.85rem;">[univer_reviews] — '
                    . esc_html__( 'Defina o atributo product_id ou use em uma página de produto.', 'univer-reviews' )
                    . '</p>';
            }
            return '';
        }

        $workspace_id  = sanitize_text_field( $atts['workspace_id'] );
        $layout        = $this->sanitize_layout( $atts['layout'] );
        $locale        = in_array( $atts['locale'], [ 'pt-BR', 'en-US', 'es-AR' ], true ) ? $atts['locale'] : 'pt-BR';
        $theme_color   = sanitize_hex_color( $atts['theme_color'] ) ?: '#d4a850';
        $show_qa       = in_array( $atts['show_qa'], [ 'true', '1', 'yes' ], true ) ? 'true' : 'false';
        $show_wr       = in_array( $atts['show_write_review'], [ 'true', '1', 'yes' ], true ) ? 'true' : 'false';
        $api_url       = esc_url( $atts['api_url'] );
        $extra_class   = sanitize_html_class( $atts['class'] );

        // Ensure widget script is loaded
        if ( ! wp_script_is( 'univer-reviews-widget', 'enqueued' ) ) {
            wp_enqueue_script(
                'univer-reviews-widget',
                UNIVER_WIDGET_CDN,
                [],
                UNIVER_VERSION,
                [ 'strategy' => 'defer', 'in_footer' => true ]
            );
        }

        return sprintf(
            '<div class="univer-reviews-wrapper %s">
                <univer-reviews
                    workspace-id="%s"
                    product-id="%s"
                    api-url="%s"
                    layout="%s"
                    locale="%s"
                    theme-color="%s"
                    show-qa="%s"
                    show-write-review="%s"
                ></univer-reviews>
            </div>',
            esc_attr( $extra_class ),
            esc_attr( $workspace_id ),
            esc_attr( $product_id ),
            esc_attr( $api_url ),
            esc_attr( $layout ),
            esc_attr( $locale ),
            esc_attr( $theme_color ),
            esc_attr( $show_qa ),
            esc_attr( $show_wr )
        );
    }

    // ─── Block Registration ────────────────────────────────────────────────

    public function register_block(): void {
        if ( ! function_exists( 'register_block_type' ) ) {
            return;
        }

        register_block_type(
            'univer-reviews/widget',
            [
                'title'           => __( 'UniverReviews Widget', 'univer-reviews' ),
                'description'     => __( 'Exibe avaliações do produto com o widget UniverReviews.', 'univer-reviews' ),
                'category'        => 'widgets',
                'render_callback' => function ( array $attrs ): string {
                    $product_id = sanitize_text_field( $attrs['productId'] ?? '' );
                    $layout     = sanitize_text_field( $attrs['layout'] ?? 'default' );
                    $locale     = sanitize_text_field( $attrs['locale'] ?? '' );
                    $class      = sanitize_html_class( $attrs['className'] ?? '' );

                    $shortcode = sprintf(
                        '[univer_reviews product_id="%s" layout="%s" locale="%s" class="%s"]',
                        esc_attr( $product_id ),
                        esc_attr( $layout ),
                        esc_attr( $locale ),
                        esc_attr( $class )
                    );

                    return do_shortcode( $shortcode );
                },
                'attributes'      => [
                    'productId' => [ 'type' => 'string', 'default' => '' ],
                    'layout'    => [ 'type' => 'string', 'default' => 'default' ],
                    'locale'    => [ 'type' => 'string', 'default' => '' ],
                    'className' => [ 'type' => 'string', 'default' => '' ],
                ],
            ]
        );
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    /**
     * Attempt to get the current product ID from WooCommerce or post ID.
     */
    private function get_current_product_id(): string {
        if ( is_singular() ) {
            return (string) get_the_ID();
        }
        return '';
    }

    private function sanitize_layout( string $layout ): string {
        $valid = [ 'default', 'compact', 'grid', 'carousel', 'side-summary' ];
        return in_array( $layout, $valid, true ) ? $layout : 'default';
    }
}
