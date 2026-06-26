(function () {
    "use strict";

    const SETUP_HINT = /record_boss_site_visit|boss_visit_stats|schema cache|function .* does not exist|relation .* does not exist/i;

    function shouldIgnore(error) {
        const message = error && error.message ? error.message : "";
        return SETUP_HINT.test(message);
    }

    async function recordVisit() {
        if (!window.JunxueSupabaseClient || typeof window.JunxueSupabaseClient.getClient !== "function") {
            return;
        }

        try {
            const client = await window.JunxueSupabaseClient.getClient();
            const sessionResponse = await client.auth.getSession();
            const session = sessionResponse.data ? sessionResponse.data.session : null;

            if (!session || !session.user) {
                return;
            }

            const response = await client.rpc("record_boss_site_visit", {
                p_page_path: window.location.pathname || "/"
            });

            if (response.error && !shouldIgnore(response.error)) {
                console.warn("[JunxueBossVisit] record failed.", response.error);
            }
        } catch (error) {
            if (!shouldIgnore(error)) {
                console.warn("[JunxueBossVisit] record failed.", error);
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", recordVisit, { once: true });
    } else {
        recordVisit();
    }
}());
