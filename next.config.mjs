/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    devIndicators: {
        appIsrStatus: false,
        buildActivity: false,
    },
};

export default nextConfig;
