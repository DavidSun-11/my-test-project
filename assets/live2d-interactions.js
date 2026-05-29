/* Live2D 互动模块：菜单、闲聊题库、答题小游戏、英雄池转盘都集中在这里，方便后续继续加题。 */
(function () {
    const chatBank = [
        {
            question: "你觉得君雪是怎么样的人？",
            options: [
                { label: "A：天资卓越", reply: "你的眼光真不错", mood: "good" },
                { label: "B：完美无瑕", reply: "你的眼光真不错", mood: "good" },
                { label: "C：才富五车", reply: "你的眼光真不错", mood: "good" },
                { label: "D：一般", reply: "你骗人", mood: "warning" }
            ]
        },
        {
            question: "如果君雪打游戏坑了怎么办？",
            options: [
                { label: "A：继续带飞", reply: "果然还是你懂我", mood: "good" },
                { label: "B：安慰她", reply: "果然还是你懂我", mood: "good" },
                { label: "C：偷偷举报", reply: "坏！记仇了！", mood: "warning" },
                { label: "D：压力队友", reply: "坏！记仇了！", mood: "warning" }
            ]
        },
        {
            question: "你会一直留在这个网站吗？",
            options: [
                { label: "A：会", reply: "那就约好了哦", mood: "good" },
                { label: "B：当然会", reply: "那就约好了哦", mood: "good" },
                { label: "C：每天都来", reply: "那就约好了哦", mood: "good" },
                { label: "D：不会", reply: "呜呜，不许走", mood: "warning" }
            ]
        },
        {
            question: "君雪和游戏哪个更重要？",
            options: [
                { label: "A：君雪", reply: "回答满分", mood: "good" },
                { label: "B：都重要", reply: "勉强接受", mood: "neutral" },
                { label: "C：先看情况", reply: "勉强接受", mood: "neutral" },
                { label: "D：游戏！", reply: "你今晚别想上分了", mood: "warning" }
            ]
        }
    ];

    const challengeBank = [
        { question: "7 + 8 = ?", options: ["13", "14", "15", "16"], answer: 2 },
        { question: "9 x 6 = ?", options: ["42", "48", "54", "56"], answer: 2 },
        { question: "56 ÷ 7 = ?", options: ["6", "7", "8", "9"], answer: 2 },
        { question: "18 + 27 = ?", options: ["35", "45", "46", "55"], answer: 1 },
        { question: "81 - 36 = ?", options: ["35", "45", "55", "57"], answer: 1 },
        { question: "12 x 4 = ?", options: ["36", "42", "48", "52"], answer: 2 },
        { question: "100 - 37 = ?", options: ["53", "63", "67", "73"], answer: 1 },
        { question: "45 ÷ 5 = ?", options: ["7", "8", "9", "10"], answer: 2 },
        { question: "23 + 19 = ?", options: ["40", "41", "42", "43"], answer: 2 },
        { question: "6 x 7 = ?", options: ["36", "40", "42", "49"], answer: 2 },
        { question: "什么东西越洗越脏？", options: ["脸", "水", "手帕", "肥皂"], answer: 1 },
        { question: "什么门永远关不上？", options: ["木门", "球门", "铁门", "校门"], answer: 1 },
        { question: "什么东西越吃越少？", options: ["米饭", "年龄", "空气", "影子"], answer: 0 },
        { question: "什么东西有脚却不会走？", options: ["桌子", "小猫", "鞋子", "钟表"], answer: 0 },
        { question: "什么东西天气越热爬得越高？", options: ["太阳", "温度计", "气球", "云"], answer: 1 },
        { question: "什么车不会动？", options: ["火车", "风车", "汽车", "电车"], answer: 1 },
        { question: "什么布剪不断？", options: ["瀑布", "棉布", "桌布", "花布"], answer: 0 },
        { question: "什么东西越用越有光？", options: ["灯泡", "镜子", "脑子", "蜡烛"], answer: 2 },
        { question: "什么东西明明是你的，别人却用得最多？", options: ["名字", "书包", "手机", "铅笔"], answer: 0 },
        { question: "什么桥下面没有水？", options: ["木桥", "天桥", "石桥", "铁桥"], answer: 1 }
    ];

    // 王者荣耀英雄池可继续补充英雄；这里先按常见主要分路分类，方便后续增删。
    const heroPools = {
        jungle: ["澜", "镜", "露娜", "韩信", "李白", "赵云", "孙悟空", "娜可露露", "云缨", "暃", "裴擒虎", "兰陵王", "阿轲", "曜", "宫本武藏"],
        marksman: ["孙尚香", "公孙离", "马可波罗", "伽罗", "后羿", "鲁班七号", "狄仁杰", "虞姬", "李元芳", "蒙犽", "百里守约", "黄忠", "戈娅", "莱西奥"],
        mid: ["貂蝉", "上官婉儿", "不知火舞", "诸葛亮", "干将莫邪", "王昭君", "小乔", "安琪拉", "西施", "弈星", "沈梦溪", "海月", "嬴政", "周瑜", "嫦娥"],
        support: ["瑶", "蔡文姬", "大乔", "孙膑", "张飞", "牛魔", "太乙真人", "鲁班大师", "明世隐", "庄周", "盾山", "鬼谷子", "桑启", "刘禅"],
        clash: ["花木兰", "马超", "关羽", "吕布", "夏洛特", "狂铁", "孙策", "亚瑟", "老夫子", "铠", "司空震", "白起", "项羽", "廉颇", "姬小满"]
    };

    const laneLabels = {
        jungle: "打野",
        marksman: "射手",
        mid: "中路",
        support: "辅助",
        clash: "对抗路"
    };

    const letters = ["A", "B", "C", "D"];
    let currentChat = null;
    let challengeState = null;
    let selectedLane = "jungle";
    let wheelRotation = 0;
    let heroSpinTimer = null;
    let heroSpinTimeout = null;

    function shuffle(items) {
        const copy = items.slice();

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const target = Math.floor(Math.random() * (index + 1));
            const temp = copy[index];
            copy[index] = copy[target];
            copy[target] = temp;
        }

        return copy;
    }

    function pickChat() {
        if (chatBank.length <= 1) {
            currentChat = chatBank[0];
            return currentChat;
        }

        let nextChat = chatBank[Math.floor(Math.random() * chatBank.length)];

        if (nextChat === currentChat) {
            const currentIndex = chatBank.indexOf(currentChat);
            nextChat = chatBank[(currentIndex + 1) % chatBank.length];
        }

        currentChat = nextChat;
        return currentChat;
    }

    function createDialog() {
        const dialog = document.createElement("div");
        dialog.className = "live2d-quiz";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-live", "polite");
        dialog.setAttribute("aria-label", "Live2D 互动");
        dialog.innerHTML = [
            '<button class="live2d-quiz__close" type="button" aria-label="关闭">×</button>',
            '<div class="live2d-quiz__meta"></div>',
            '<div class="live2d-quiz__question"></div>',
            '<div class="live2d-quiz__options"></div>',
            '<div class="live2d-quiz__result"></div>'
        ].join("");
        document.body.appendChild(dialog);
        return dialog;
    }

    function createHitArea() {
        const hitArea = document.createElement("button");
        hitArea.className = "live2d-hit-area";
        hitArea.type = "button";
        hitArea.setAttribute("aria-label", "点击 Live2D 看板娘");
        document.body.appendChild(hitArea);
        return hitArea;
    }

    function findLive2DRoots() {
        const selectors = [
            "#live2d-widget",
            "#oml2d-main",
            "#oml2d-stage",
            "#oml2d-canvas",
            ".oml2d-main",
            ".oml2d-stage",
            ".oml2d-canvas",
            "[id^='oml2d']",
            "[class*='oml2d']",
            "canvas"
        ];
        const roots = [];

        selectors.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (node) {
                const rect = node.getBoundingClientRect();
                const isLeftBottom = rect.left < 360 && rect.bottom > window.innerHeight - 520;

                if ((selector !== "canvas" || isLeftBottom) && !roots.includes(node)) {
                    roots.push(node);
                }
            });
        });

        return roots;
    }

    function initInteractions() {
        const dialog = createDialog();
        const hitArea = createHitArea();
        const closeButton = dialog.querySelector(".live2d-quiz__close");
        const meta = dialog.querySelector(".live2d-quiz__meta");
        const question = dialog.querySelector(".live2d-quiz__question");
        const options = dialog.querySelector(".live2d-quiz__options");
        const result = dialog.querySelector(".live2d-quiz__result");
        const boundNodes = new WeakSet();

        function clearSpinTimers() {
            window.clearInterval(heroSpinTimer);
            window.clearTimeout(heroSpinTimeout);
            heroSpinTimer = null;
            heroSpinTimeout = null;
        }

        function clearDialog() {
            clearSpinTimers();
            dialog.classList.remove("is-wheel");
            meta.textContent = "";
            question.textContent = "";
            options.innerHTML = "";
            result.textContent = "";
            result.className = "live2d-quiz__result";
            options.className = "live2d-quiz__options";
        }

        function replayOpenAnimation() {
            dialog.classList.remove("is-opening");
            void dialog.offsetWidth;
            dialog.classList.add("is-opening");
        }

        function showDialog() {
            dialog.classList.add("is-open");
            replayOpenAnimation();
            window.clearTimeout(showDialog.closeTimer);
        }

        function closeDialog() {
            clearSpinTimers();
            dialog.classList.remove("is-open", "is-opening");
            window.clearTimeout(showDialog.closeTimer);
        }

        function addOption(label, onClick) {
            const button = document.createElement("button");
            button.className = "live2d-quiz__option";
            button.type = "button";
            button.textContent = label;
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                onClick(button, event);
            });
            options.appendChild(button);
            return button;
        }

        function showMenu(event) {
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            clearDialog();
            question.textContent = "想和君雪做什么？";
            options.classList.add("live2d-quiz__menu");
            addOption("闲聊", showChat);
            addOption("我们比比看", startChallenge);
            addOption("英雄池转盘", showHeroWheel);
            showDialog();
        }

        function showChat() {
            const chat = pickChat();

            clearDialog();
            meta.textContent = "闲聊时间";
            question.textContent = chat.question;

            chat.options.forEach(function (option) {
                const button = addOption(option.label, function () {
                    result.textContent = option.reply;
                    result.className = "live2d-quiz__result is-" + option.mood;
                    window.clearTimeout(showDialog.closeTimer);
                    showDialog.closeTimer = window.setTimeout(closeDialog, 3500);
                });
                button.dataset.mood = option.mood;
            });

            showDialog();
        }

        function startChallenge() {
            challengeState = {
                questions: shuffle(challengeBank).slice(0, 10),
                index: 0,
                correct: 0,
                locked: false
            };
            renderChallengeQuestion();
            showDialog();
        }

        function renderChallengeQuestion() {
            const current = challengeState.questions[challengeState.index];

            clearDialog();
            meta.textContent = "我们比比看 · 第 " + (challengeState.index + 1) + " / 10 题";
            question.textContent = current.question;

            current.options.forEach(function (option, index) {
                addOption(letters[index] + "：" + option, function (button) {
                    answerChallenge(index, button);
                });
            });
        }

        function answerChallenge(selectedIndex, selectedButton) {
            const current = challengeState.questions[challengeState.index];
            const optionButtons = options.querySelectorAll(".live2d-quiz__option");
            const isCorrect = selectedIndex === current.answer;

            if (challengeState.locked) {
                return;
            }

            challengeState.locked = true;
            optionButtons.forEach(function (button) {
                button.disabled = true;
            });

            if (isCorrect) {
                challengeState.correct += 1;
                selectedButton.classList.add("is-correct");
                result.textContent = "真棒，离天才又进一步";
                result.className = "live2d-quiz__result is-good";
            } else {
                selectedButton.classList.add("is-wrong");
                optionButtons[current.answer].classList.add("is-correct");
                result.textContent = "真笨，这么简单都不会，去问问君雪吧";
                result.className = "live2d-quiz__result is-warning";
            }

            window.setTimeout(function () {
                challengeState.index += 1;
                challengeState.locked = false;

                if (challengeState.index >= challengeState.questions.length) {
                    showChallengeEnd();
                    return;
                }

                renderChallengeQuestion();
            }, 1200);
        }

        function showChallengeEnd() {
            clearDialog();
            meta.textContent = "挑战结算";
            question.textContent = "挑战结束！你答对了 " + challengeState.correct + " / 10 题。";
            options.classList.add("live2d-quiz__menu");
            addOption("再来一局", startChallenge);
            addOption("回到菜单", function () {
                showMenu();
            });
            result.textContent = challengeState.correct >= 8 ? "不错嘛，君雪认可你了" : "还得练练，君雪在旁边看着呢";
            result.className = challengeState.correct >= 8 ? "live2d-quiz__result is-good" : "live2d-quiz__result is-neutral";
        }

        function showHeroWheel() {
            clearDialog();
            dialog.classList.add("is-wheel");
            options.classList.add("live2d-quiz__wheel-panel");
            meta.textContent = "英雄池转盘";
            question.textContent = "先选分路，再让君雪帮你抽一个英雄。";
            options.innerHTML = [
                '<div class="live2d-wheel__lanes" aria-label="选择分路"></div>',
                '<div class="live2d-wheel" aria-label="英雄转盘">',
                    '<div class="live2d-wheel__pointer"></div>',
                    '<div class="live2d-wheel__disc">',
                        '<div class="live2d-wheel__ring"></div>',
                        '<div class="live2d-wheel__hero">准备抽取</div>',
                    '</div>',
                '</div>',
                '<button class="live2d-wheel__draw" type="button">开始抽取</button>',
                '<div class="live2d-wheel__actions">',
                    '<button class="live2d-wheel__small" type="button" data-action="again">重新抽取</button>',
                    '<button class="live2d-wheel__small" type="button" data-action="back">回到菜单</button>',
                '</div>'
            ].join("");

            const lanes = options.querySelector(".live2d-wheel__lanes");
            const disc = options.querySelector(".live2d-wheel__disc");
            const heroName = options.querySelector(".live2d-wheel__hero");
            const drawButton = options.querySelector(".live2d-wheel__draw");
            const againButton = options.querySelector('[data-action="again"]');
            const backButton = options.querySelector('[data-action="back"]');

            Object.keys(heroPools).forEach(function (lane) {
                const button = document.createElement("button");
                button.className = "live2d-wheel__lane";
                button.type = "button";
                button.dataset.lane = lane;
                button.textContent = laneLabels[lane];
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    if (drawButton.disabled) {
                        return;
                    }

                    selectedLane = lane;
                    updateLaneButtons();
                    previewHeroNames();
                    result.textContent = "已选择：" + laneLabels[selectedLane];
                    result.className = "live2d-quiz__result is-neutral";
                });
                lanes.appendChild(button);
            });

            function setControlsDisabled(disabled) {
                drawButton.disabled = disabled;
                againButton.disabled = disabled;
                lanes.querySelectorAll("button").forEach(function (button) {
                    button.disabled = disabled;
                });
            }

            function updateLaneButtons() {
                lanes.querySelectorAll("button").forEach(function (button) {
                    button.classList.toggle("is-active", button.dataset.lane === selectedLane);
                });
            }

            function previewHeroNames() {
                heroName.textContent = shuffle(heroPools[selectedLane]).slice(0, 3).join(" / ");
            }

            function drawHero() {
                const pool = heroPools[selectedLane];
                const hero = pool[Math.floor(Math.random() * pool.length)];

                clearSpinTimers();
                setControlsDisabled(true);
                result.textContent = "转盘启动中，君雪正在认真思考...";
                result.className = "live2d-quiz__result is-neutral";
                disc.classList.add("is-spinning");
                wheelRotation += 1440 + Math.floor(Math.random() * 720);
                disc.style.transform = "rotate(" + wheelRotation + "deg)";

                heroSpinTimer = window.setInterval(function () {
                    heroName.textContent = pool[Math.floor(Math.random() * pool.length)];
                }, 80);

                heroSpinTimeout = window.setTimeout(function () {
                    clearSpinTimers();
                    heroName.textContent = hero;
                    disc.classList.remove("is-spinning");
                    setControlsDisabled(false);
                    result.textContent = "君雪为你抽到了：" + hero;
                    result.className = "live2d-quiz__result is-good";
                }, 1900);
            }

            drawButton.addEventListener("click", function (event) {
                event.stopPropagation();
                drawHero();
            });
            againButton.addEventListener("click", function (event) {
                event.stopPropagation();
                drawHero();
            });
            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showMenu();
            });

            updateLaneButtons();
            previewHeroNames();
            result.textContent = "已选择：" + laneLabels[selectedLane];
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function bindNode(node) {
            if (!node || boundNodes.has(node) || node === dialog || dialog.contains(node)) {
                return;
            }

            boundNodes.add(node);
            node.style.pointerEvents = "auto";

            if (node !== hitArea) {
                node.style.zIndex = node.style.zIndex || "42";
            }

            node.addEventListener("click", showMenu, true);
            node.addEventListener("touchstart", showMenu, {
                capture: true,
                passive: false
            });
        }

        function bindLive2DRoots() {
            findLive2DRoots().forEach(bindNode);
        }

        bindNode(hitArea);
        bindLive2DRoots();

        const observer = new MutationObserver(bindLive2DRoots);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.setTimeout(bindLive2DRoots, 500);
        window.setTimeout(bindLive2DRoots, 1500);
        window.setTimeout(bindLive2DRoots, 3000);

        closeButton.addEventListener("click", function (event) {
            event.stopPropagation();
            closeDialog();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeDialog();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initInteractions);
        return;
    }

    initInteractions();
})();
