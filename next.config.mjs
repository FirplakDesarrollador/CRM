import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    devIndicators: {
        appIsrStatus: false,
        buildActivity: false,
    },
    // Turbopack config (Next.js 16 default)
    turbopack: {},
    // Forzado de Webpack para compatibilidad con PWA
    webpack: (config) => {
        return config;
    },
    compiler: {
        removeConsole: process.env.NODE_ENV === "production",
    },
};

const withPWA = withPWAInit({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swMinify: true,
    disable: process.env.NODE_ENV === "development",
    fallbacks: {
        document: "/offline",
    },
    workboxOptions: {
        disableDevLogs: true,
        additionalManifestEntries: [
            { url: "/offline", revision: Date.now().toString() },
            { url: "/", revision: Date.now().toString() },
        ],
        runtimeCaching: [
            {
                urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
                handler: "CacheFirst",
                options: {
                    cacheName: "google-fonts-webfonts",
                    expiration: {
                        maxEntries: 4,
                        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                    },
                },
            },
            {
                urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "google-fonts-stylesheets",
                    expiration: {
                        maxEntries: 4,
                        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                    },
                },
            },
            {
                urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
                handler: "CacheFirst",
                options: {
                    cacheName: "static-font-assets",
                    expiration: {
                        maxEntries: 4,
                        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                    },
                },
            },
            {
                urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "static-image-assets",
                    expiration: {
                        maxEntries: 64,
                        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                    },
                },
            },
            {
                urlPattern: /\/_next\/image\?url=.+/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "next-image",
                    expiration: {
                        maxEntries: 64,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            },
            {
                urlPattern: /\.(?:js)$/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "static-js-assets",
                    expiration: {
                        maxEntries: 32,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            },
            {
                urlPattern: /\.(?:css|less)$/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "static-style-assets",
                    expiration: {
                        maxEntries: 32,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            },
            {
                urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "next-data",
                    expiration: {
                        maxEntries: 32,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            },
            {
                urlPattern: /\/api\/.*$/i,
                handler: "NetworkFirst",
                options: {
                    cacheName: "apis",
                    networkTimeoutSeconds: 10,
                    expiration: {
                        maxEntries: 16,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                    cacheableResponse: {
                        statuses: [0, 200],
                    },
                },
            },
            {
                urlPattern: /.*/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "others",
                    expiration: {
                        maxEntries: 32,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            },
        ],
    },
});

export default withPWA(nextConfig);
