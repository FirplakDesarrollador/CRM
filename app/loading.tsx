/**
 * PERF FIX: Replaced full-screen backdrop-blur overlay with a minimal top progress bar.
 * backdrop-blur-md forces the GPU to re-composite the entire viewport (~50-100ms per frame),
 * which was a primary cause of perceived navigation slowness.
 * This thin progress bar is nearly zero-cost to render.
 */
export default function Loading() {
    return (
        <div className="fixed top-0 left-0 right-0 z-9999 h-1 bg-slate-100 overflow-hidden">
            <div
                className="h-full bg-linear-to-r from-blue-600 to-[#254153] animate-loading-bar"
                style={{ width: '40%' }}
            />
        </div>
    );
}
