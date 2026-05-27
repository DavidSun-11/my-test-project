(function () {
    const players = document.querySelectorAll(".netease-player");

    function createAudio(src) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = src;
        audio.setAttribute("aria-label", "本地音频播放器：醉赤壁");
        return audio;
    }

    async function exists(src) {
        try {
            const response = await fetch(src, {
                method: "HEAD",
                cache: "no-store"
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    players.forEach(async function (player) {
        const localSrc = player.dataset.localSrc;

        if (!localSrc) {
            return;
        }

        const canUseLocalAudio = await exists(localSrc);

        if (!canUseLocalAudio) {
            player.classList.add("is-iframe-player");
            return;
        }

        player.classList.add("is-local-audio");
        player.replaceChildren(createAudio(localSrc));
    });
})();
