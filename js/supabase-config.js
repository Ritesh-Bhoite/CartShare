window.CARTSHARE_SUPABASE_URL = "https://wkwgjjrrxtahzsmsnhaa.supabase.co";

window.CARTSHARE_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_ojw2rhF19WP59zxzOWTNkQ_O64e8_5o";

window.cartShareSupabase = null;
window.cartShareSupabaseInitError = null;

try {
    if (typeof window.supabase?.createClient !== "function") {
        throw new Error("Supabase JS v2 failed to load before supabase-config.js.");
    }
    if (!window.CARTSHARE_SUPABASE_URL || !window.CARTSHARE_SUPABASE_PUBLISHABLE_KEY) {
        throw new Error("The Supabase project URL or publishable key is missing.");
    }

    window.cartShareSupabase = window.supabase.createClient(
        window.CARTSHARE_SUPABASE_URL,
        window.CARTSHARE_SUPABASE_PUBLISHABLE_KEY
    );
} catch (error) {
    window.cartShareSupabaseInitError = error;
    console.error("[CartShare] Supabase client initialization failed.", error);
}