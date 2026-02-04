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
    workboxOptions: {
        disableDevLogs: true,
    },
});

export default withPWA(nextConfig);
