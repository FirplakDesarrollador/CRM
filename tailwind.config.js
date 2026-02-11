/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            zIndex: {
                '9999': '9999',
            },
            keyframes: {
                loading: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(350%)' },
                }
            },
            animation: {
                'loading-bar': 'loading 1.2s ease-in-out infinite',
            }
        }
    },
    plugins: []
};
