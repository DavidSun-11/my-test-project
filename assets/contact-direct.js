(function () {
    "use strict";

    const VERSION = "20260717-contact-direct-moon-garden1";
    const COPY_FAILURE_TEXT = "复制失败，请手动选择号码复制。";
    const toast = document.querySelector("[data-contact-toast]");
    let toastTimer = 0;

    window.Live2DWidgetConfig = {
        modelName: "ganyu",
        modelPath: "live2d/models/ganyu/Ganyu1024.model3.json",
        dockedPosition: "left",
        scale: 0.11,
        stageStyle: {
            width: 380,
            height: 700
        },
        mobileScale: 0.058,
        mobileStageStyle: {
            width: 192,
            height: 320
        }
    };

    if (window.JunxuePerformanceMode && typeof window.JunxuePerformanceMode.applyLive2DConfig === "function") {
        window.JunxuePerformanceMode.applyLive2DConfig(window.Live2DWidgetConfig);
    }

    function showToast(message, isError) {
        if (!toast) {
            return;
        }

        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.toggle("is-error", !!isError);
        toast.hidden = false;
        toastTimer = window.setTimeout(function () {
            toast.hidden = true;
        }, 2400);
    }

    function fallbackCopy(value) {
        const input = document.createElement("textarea");
        let copied = false;

        input.value = value;
        input.setAttribute("readonly", "");
        input.setAttribute("aria-hidden", "true");
        input.style.position = "fixed";
        input.style.left = "-9999px";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        input.setSelectionRange(0, input.value.length);

        try {
            copied = document.execCommand("copy");
        } catch (error) {
            copied = false;
        }

        input.remove();
        return copied;
    }

    async function copyContact(value) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(value);
                return true;
            } catch (error) {}
        }

        return fallbackCopy(value);
    }

    document.querySelectorAll("[data-contact-copy]").forEach(function (button) {
        button.addEventListener("click", async function () {
            const value = button.dataset.contactValue || "";
            const label = button.dataset.contactLabel || "联系方式";

            if (!value) {
                showToast(COPY_FAILURE_TEXT, true);
                return;
            }

            const copied = await copyContact(value);
            showToast(copied ? label + "已复制" : COPY_FAILURE_TEXT, !copied);
        });
    });

    window.JunxueContactDirect = {
        version: VERSION
    };
}());
