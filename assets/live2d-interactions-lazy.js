/* Live2D 互动模块：菜单、无奖竞答题库、英雄池转盘、咨询功能都集中在这里，方便后续继续加题。 */
(function () {
    if (window.__JUNXUE_LIVE2D_LAZY_INTERACTIONS_INSTALLED__ && window.Live2DInteractiveMenu && window.Live2DInteractiveMenu.ready) {
        return;
    }

    window.__JUNXUE_LIVE2D_LAZY_INTERACTIONS_INSTALLED__ = true;

    if (window.Live2DInteractiveMenu && window.Live2DInteractiveMenu.ready) {
        return;
    }

    if (typeof window.enableGanyuIdleTalk !== "boolean") {
        window.enableGanyuIdleTalk = true;
    }

    const SUPABASE_LOCAL_SDK = "assets/vendor/supabase-js-2.min.js?v=20260616-1";
    const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js";
    const SUPABASE_SDK_LOAD_ERROR_TEXT = "老板评价功能加载失败，可能是网络暂时不稳定，请稍后再试。";
    const SCORE_GUESS_CHOICES = ["铜牌", "银牌", "金牌", "顶级", "无"];
    const SCORE_GUESS_LOAD_ERROR_TEXT = "评分竞猜暂时加载失败，可能是网络不稳定，请稍后再试。";
    const CHECKIN_SETUP_ERROR_TEXT = "签到功能还需要执行数据库升级 SQL。";
    const CHECKIN_NETWORK_ERROR_TEXT = "签到暂时没有连上星湖，稍后再试一次。";
    const CHECKIN_ALREADY_SIGNED_TEXT = "今天已经签到过啦，明天再来见甘雨吧。";
    const BLOCKED_INTERACTION_TEXT = "当前账号暂时不能参与互动，如有疑问可以联系君雪。";
    const BOSS_PROFILE_SCRIPT_LOAD_ERROR_TEXT = "老板资料脚本暂时没有加载完成，请刷新页面后再试。";
    let scoreGuessRealtimeChannels = [];
    let scoreGuessRealtimeWarningShown = false;
    let scoreGuessState = {
        client: null,
        session: null,
        authSession: null,
        votes: [],
        isAdmin: false,
        realtimeWarning: false
    };
    let live2dAdminMenuState = {
        loaded: false,
        isAdmin: false,
        sessionKey: "",
        loadingPromise: null
    };
    let live2dMainMenuRenderToken = 0;

    const quizBank = [
        {
            question: "你觉得君雪是怎么样的人？",
            options: ["天资卓越", "完美无瑕", "才富五车", "一般"],
            correct: [0, 1, 2]
        },
        {
            question: "如果君雪打游戏坑了怎么办？",
            options: ["继续带飞", "安慰她", "偷偷举报", "压力队友"],
            correct: [0, 1]
        },
        {
            question: "你会一直留在这个网站吗？",
            options: ["会", "当然会", "每天都来", "不会"],
            correct: [0, 1, 2]
        },
        {
            question: "君雪和游戏哪个更重要？",
            options: ["君雪", "都重要", "先看情况", "游戏！"],
            correct: [0, 1, 2]
        },
        {
            question: "君雪在星空下最适合做什么？",
            options: ["继续变强", "发呆看星星", "偷偷休息", "拆掉网站"],
            correct: [0, 1, 2]
        },
        { question: "7 + 8 = ?", options: ["13", "14", "15", "16"], correct: [2] },
        { question: "9 x 6 = ?", options: ["42", "48", "54", "56"], correct: [2] },
        { question: "56 ÷ 7 = ?", options: ["6", "7", "8", "9"], correct: [2] },
        { question: "18 + 27 = ?", options: ["35", "45", "46", "55"], correct: [1] },
        { question: "81 - 36 = ?", options: ["35", "45", "55", "57"], correct: [1] },
        { question: "12 x 4 = ?", options: ["36", "42", "48", "52"], correct: [2] },
        { question: "100 - 37 = ?", options: ["53", "63", "67", "73"], correct: [1] },
        { question: "45 ÷ 5 = ?", options: ["7", "8", "9", "10"], correct: [2] },
        { question: "23 + 19 = ?", options: ["40", "41", "42", "43"], correct: [2] },
        { question: "6 x 7 = ?", options: ["36", "40", "42", "49"], correct: [2] },
        { question: "什么东西越洗越脏？", options: ["脸", "水", "手帕", "肥皂"], correct: [1] },
        { question: "什么门永远关不上？", options: ["木门", "球门", "铁门", "校门"], correct: [1] },
        { question: "什么东西越吃越少？", options: ["米饭", "年龄", "空气", "影子"], correct: [0] },
        { question: "什么东西有脚却不会走？", options: ["桌子", "小猫", "鞋子", "钟表"], correct: [0] },
        { question: "什么东西天气越热爬得越高？", options: ["太阳", "温度计", "气球", "云"], correct: [1] },
        { question: "什么车不会动？", options: ["火车", "风车", "汽车", "电车"], correct: [1] },
        { question: "什么布剪不断？", options: ["瀑布", "棉布", "桌布", "花布"], correct: [0] },
        { question: "什么东西越用越有光？", options: ["灯泡", "镜子", "脑子", "蜡烛"], correct: [2] },
        { question: "什么东西明明是你的，别人却用得最多？", options: ["名字", "书包", "手机", "铅笔"], correct: [0] },
        { question: "什么桥下面没有水？", options: ["木桥", "天桥", "石桥", "铁桥"], correct: [1] }
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

    const weatherCodeLabels = {
        0: "晴朗",
        1: "大部晴朗",
        2: "局部多云",
        3: "阴天",
        45: "有雾",
        48: "雾凇",
        51: "小毛毛雨",
        53: "毛毛雨",
        55: "较强毛毛雨",
        56: "冻毛毛雨",
        57: "强冻毛毛雨",
        61: "小雨",
        63: "中雨",
        65: "大雨",
        66: "冻雨",
        67: "强冻雨",
        71: "小雪",
        73: "中雪",
        75: "大雪",
        77: "雪粒",
        80: "阵雨",
        81: "较强阵雨",
        82: "强阵雨",
        85: "阵雪",
        86: "强阵雪",
        95: "雷暴",
        96: "雷暴伴冰雹",
        99: "强雷暴伴冰雹"
    };

    const letters = ["A", "B", "C", "D"];
    let quizState = null;
    let selectedLane = "jungle";
    let wheelRotation = 0;
    let heroSpinTimer = null;
    let heroSpinTimeout = null;
    let openingVoicePlaying = false;
    let openingVoiceRetryPending = false;
    let openingVoiceRetryBound = false;
    let currentMusicIndex = 0;
    let musicPlaying = false;
    const openingVoiceText = "万家灯火就在眼前，人们的生活究竟是什么样的呢…欸？你想邀我去夜市？啊…不，不好意思，我就不去了吧。";
    const openingVoicePath = "assets/audio/ganyu_opening.mp3";
    let firstClickVoicePlaying = false;
    const firstClickVoiceStorageKey = "live2d_first_click_voice_played";
    const firstClickVoiceText = "早上好...嗯？是哪里没有梳理好吗，请不要盯着我的...盯着我的头饰看。";
    const firstClickVoicePath = "assets/audio/ganyu_first_click.mp3";
    const quizExitVoiceText = "今天的题目就到这里啦～\n如果下次还想考考自己，记得再来找甘雨哦。";
    const quizExitVoicePath = "assets/audio/ganyu_quiz_exit.mp3";
    const fortuneVoicePath = "assets/audio/ganyu_fortune.mp3";
    const fortuneBubbleText = "星象已经给出答案了，剩下的路，要由你自己决定。";
    const fortuneStorageKeyPrefix = "junxue_fortune_";
    // 以后新增本地歌曲，只需要把 mp3 放到 assets/audio/，然后在 LOCAL_MUSIC_TRACKS 里加一项。
    // lrc 可以先预留，后续再做歌词显示。本轮不要加载 lrc。
    const LOCAL_MUSIC_TRACKS = [
        { title: "感谢你曾来过", artist: "", src: "assets/audio/music.mp3" },
        { title: "不要说话", artist: "", src: "assets/audio/dont-speak.mp3" },
        {
            title: "学会自己长大",
            artist: "Rom邢锐",
            src: "assets/audio/xuehui-ziji-zhangda.mp3",
            lrc: "assets/lyrics/xuehui-ziji-zhangda.lrc"
        },
        {
            title: "妈妈的话",
            artist: "渡川",
            src: "assets/audio/mamadehua.mp3",
            lrc: "assets/lyrics/mamadehua.lrc"
        },
        {
            title: "念旧",
            artist: "姜铭杨",
            src: "assets/audio/nianjiu.mp3",
            lrc: "assets/lyrics/nianjiu.lrc"
        },
        {
            title: "变天",
            artist: "张紫豪",
            src: "assets/audio/张紫豪 - 变天.mp3"
        },
        {
            title: "我总想问问你",
            artist: "杨树人",
            src: "assets/audio/杨树人 - 我总想问问你.mp3"
        },
        {
            title: "我好像在哪见过你",
            artist: "薛之谦",
            src: "assets/audio/薛之谦 - 我好像在哪见过你.mp3"
        }
    ];
    const musicList = LOCAL_MUSIC_TRACKS;
    const fortuneLevels = ["大吉", "中吉", "小吉", "平", "小凶"];
    const fortuneLevelClasses = {
        "大吉": "live2d-fortune-value--great",
        "中吉": "live2d-fortune-value--good",
        "小吉": "live2d-fortune-value--small-good",
        "平": "live2d-fortune-value--plain",
        "小凶": "live2d-fortune-value--caution"
    };
    const luckyColors = ["月白", "星蓝", "霜紫", "云粉", "雪青", "晨金", "海盐蓝", "薄荷绿", "樱花粉"];
    const fortuneAdviceList = [
        "把重要的事情放在上午完成，心会更安定。",
        "慢一点也没关系，今天适合稳稳地前进。",
        "适合整理计划，也适合给自己留一点休息时间。",
        "遇到犹豫时，先做最小的一步。",
        "今天适合和可靠的人说说心里话。",
        "别急着否定自己，答案会在行动里慢慢清楚。",
        "给桌面、心情和任务都留一点空白。",
        "如果感到疲惫，就先把呼吸放慢。",
        "适合尝试一件一直想做的小事。",
        "保持温柔，但也别忘了坚定自己的边界。"
    ];
    const ganyuCalendarTips = [
        "今天也要认真完成自己的事务哦。",
        "把事情一件一件整理好，心也会慢慢安定下来。",
        "如果累了，就给自己留一点休息时间吧。",
        "愿今天的你，也能遇到一点温柔的幸运。",
        "先完成最重要的小事，剩下的路会清楚很多。",
        "不要太勉强自己，稳定前进也很好。",
        "记得喝水，也记得照顾好心情。",
        "今日的星光很安静，适合认真生活。"
    ];
    const ganyuQuotes = [
        "星空会指引方向，但选择的人始终是你。",
        "月光落下来的时候，也会替努力的人照亮脚边的路。",
        "若今天的风有些冷，就把心事先交给云吧。",
        "甘雨相信，慢慢走的人也会抵达很远的地方。",
        "星河不会催促你，它只是在安静地陪你向前。",
        "愿你今晚睡得安稳，明天醒来仍有期待。",
        "温柔不是软弱，是在风雪里仍愿意守住光。",
        "有些答案不必立刻找到，先照顾好自己也很好。",
        "若前路暂时看不清，就先看向离你最近的一颗星。",
        "今天已经做得很好了，请把这句话也算进收获里。",
        "每一盏灯火背后，都有值得被珍惜的平凡愿望。",
        "云散之前，月亮也一直在那里。",
        "愿你的努力像霜花一样，安静却闪闪发亮。",
        "把不安放轻一点，把喜欢的事握紧一点。",
        "就算只是小小一步，也是在向自己的明天靠近。"
    ];
    const ganyuIdleLines = [
        "今天也辛苦了，记得休息一下哦。",
        "如果累了，就先停下来看看星空吧。",
        "我会在这里陪着你的。",
        "月光很安静，像是适合思考的夜晚。",
        "不用着急，慢慢来也可以。",
        "你回来啦，我刚好也在等你。",
        "今天想听歌，还是想占卜呢？",
        "如果有什么烦恼，也可以告诉我。",
        "星光很远，但总会抵达眼前。",
        "希望今天的你，也能被温柔以待。",
        "别总是熬夜哦，身体也很重要。",
        "天气冷的话，要记得添衣。",
        "今天的心情怎么样？",
        "能再见到你，我很开心。",
        "即使只是安静待着，也很好。",
        "愿你今天遇到一点小小的幸运。",
        "如果不知道该做什么，就先喝口水吧。",
        "我会认真听你说的。",
        "今晚的星空，看起来很适合许愿。",
        "请不要太勉强自己。",
        "云很轻，心事也可以慢慢放轻。",
        "就算只是安静地待一会儿，也没关系。",
        "愿星光替你留住一点温柔。",
        "今天也请把自己放在心上。",
        "不开心的时候，也可以先深呼吸一下。",
        "慢慢整理思绪，答案会清楚起来的。",
        "月海亭的工作很多，但我会抽空陪你。",
        "无论今天怎样，都请温柔地对待自己。",
        "夜风很轻，适合把烦恼暂时放下。",
        "愿你抬头时，刚好能看见一点光。",
        "如果今天有些疲惫，也请允许自己慢下来。",
        "把心事说出来一点，也许会轻松些。",
        "我会在这里，安静地陪你一会儿。"
    ];
    let musicAudio = null;

    function playVoice(file) {
        const audio = new Audio(file);

        audio.volume = 0.8;
        return new Promise(function (resolve) {
            let done = false;
            const timer = window.setTimeout(finish, 15000);

            function finish() {
                if (done) {
                    return;
                }

                done = true;
                window.clearTimeout(timer);
                resolve();
            }

            audio.addEventListener("ended", finish, { once: true });
            audio.addEventListener("error", finish, { once: true });
            audio.play().catch(finish);
        });
    }

    function playOpeningVoice() {
        const audio = new Audio(openingVoicePath);

        audio.volume = 0.8;
        return new Promise(function (resolve) {
            let done = false;
            let started = false;
            const timer = window.setTimeout(finish, 8000);

            function finish() {
                if (done) {
                    return;
                }

                done = true;
                window.clearTimeout(timer);
                resolve(started);
            }

            function markStarted() {
                started = true;
            }

            audio.addEventListener("ended", finish, { once: true });
            audio.addEventListener("error", finish, { once: true });

            const playRequest = audio.play();

            if (playRequest && typeof playRequest.then === "function") {
                playRequest.then(markStarted).catch(finish);
                return;
            }

            markStarted();
        });
    }

    function hasPlayedStoredVoice(key) {
        try {
            return localStorage.getItem(key) === "true";
        } catch (error) {
            return false;
        }
    }

    function markStoredVoicePlayed(key) {
        try {
            localStorage.setItem(key, "true");
        } catch (error) {
            // localStorage 不可用时，只在当前页面避免重复播放。
        }
    }

    function hasPlayedFirstClickVoice() {
        return hasPlayedStoredVoice(firstClickVoiceStorageKey);
    }

    function markFirstClickVoicePlayed() {
        markStoredVoicePlayed(firstClickVoiceStorageKey);
    }

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

    function pickQuizQuestion() {
        const candidates = quizState && quizState.lastQuestion
            ? quizBank.filter(function (item) {
                return item !== quizState.lastQuestion;
            })
            : quizBank;

        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"]/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;"
            }[char];
        });
    }

    function getDisplayNameFromAuthUser(user) {
        if (!user) {
            return "未登录";
        }

        const metadata = user.user_metadata || {};
        const name = metadata.boss_nickname || metadata.nickname || metadata.display_name || metadata.full_name || metadata.name;

        if (typeof name === "string" && name.trim()) {
            return name.trim();
        }

        if (typeof user.email === "string" && user.email.indexOf("@") > 0) {
            return user.email.split("@")[0] || "已登录";
        }

        return "已登录";
    }

    function formatTemperature(value) {
        return Number.isFinite(value) ? Math.round(value) + "°C" : "--";
    }

    function getDayLabel(index) {
        return ["今天", "明天", "后天"][index] || "第 " + (index + 1) + " 天";
    }

    function getWeatherLabel(code) {
        return weatherCodeLabels[code] || "天气变化中";
    }

    function getPrecipitationText(daily, index) {
        const probabilities = daily.precipitation_probability_max || [];
        const sums = daily.precipitation_sum || [];

        if (probabilities[index] !== null && probabilities[index] !== undefined) {
            return "降水概率 " + probabilities[index] + "%";
        }

        if (sums[index] !== null && sums[index] !== undefined) {
            return "降水量 " + sums[index] + "mm";
        }

        return "降水数据暂无";
    }

    function normalizeCityName(cityName) {
        return cityName.trim().replace(/\s+/g, "").replace(/[市区县]+$/, "");
    }

    const cityFallbackMap = {
        "莱州": {
            name: "莱州",
            admin1: "山东",
            country: "中国",
            latitude: 37.18,
            longitude: 119.94
        },
        "扬州": {
            name: "扬州",
            admin1: "江苏",
            country: "中国",
            latitude: 32.39,
            longitude: 119.42
        }
    };

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

    function ensureOpeningBubbleStyles() {
        const existingStyle = document.getElementById("live2d-opening-bubble-style");
        if (existingStyle) {
            if (existingStyle.textContent && existingStyle.textContent.indexOf("20260626-contact-register-entry1") !== -1) {
                return;
            }
            existingStyle.remove();
        }

        const style = document.createElement("style");
        style.id = "live2d-opening-bubble-style";
        style.textContent = [
            "/* 20260626-contact-register-entry1 */",
            ".live2d-quiz{position:fixed;left:252px;top:160px;right:auto;bottom:auto;z-index:63;}",
            ".live2d-opening-bubble{position:fixed;left:252px;top:160px;z-index:61;width:min(328px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(255,236,245,.88);border-radius:16px;background:rgba(255,178,211,.76);box-shadow:0 0 22px rgba(255,142,196,.38),inset 0 0 14px rgba(255,255,255,.16);backdrop-filter:blur(10px);color:rgba(92,28,58,.96);font-size:14px;line-height:1.55;letter-spacing:0;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-opening-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-opening-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            ".live2d-quiz-exit-bubble{position:fixed;left:252px;top:160px;z-index:62;width:min(318px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(213,244,255,.76);border-radius:16px;background:linear-gradient(145deg,rgba(255,178,218,.7),rgba(126,219,255,.58));box-shadow:0 0 22px rgba(126,219,255,.28),0 0 18px rgba(255,142,196,.24),inset 0 0 14px rgba(255,255,255,.14);backdrop-filter:blur(10px);color:rgba(50,32,72,.96);font-size:14px;line-height:1.55;letter-spacing:0;white-space:pre-line;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-quiz-exit-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-quiz-exit-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            ".live2d-idle-bubble{position:fixed;left:252px;top:160px;z-index:62;width:min(318px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(213,244,255,.78);border-radius:16px;background:linear-gradient(145deg,rgba(255,182,220,.72),rgba(132,221,255,.58));box-shadow:0 0 20px rgba(126,219,255,.26),0 0 16px rgba(255,142,196,.22),inset 0 0 14px rgba(255,255,255,.14);backdrop-filter:blur(10px);color:rgba(48,32,72,.96);font-size:14px;line-height:1.55;letter-spacing:0;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-idle-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-idle-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            ".live2d-quiz.is-main-menu,.live2d-quiz.is-score-guess{border:1px solid rgba(173,234,255,.72);border-radius:22px;background:radial-gradient(circle at 18% 0%,rgba(128,221,255,.26),transparent 38%),radial-gradient(circle at 88% 14%,rgba(213,170,255,.18),transparent 36%),linear-gradient(145deg,rgba(16,39,68,.9),rgba(24,57,90,.78) 52%,rgba(31,42,84,.82));box-shadow:0 18px 46px rgba(3,18,42,.48),0 0 30px rgba(93,204,255,.24),inset 0 1px 0 rgba(255,255,255,.24),inset 0 -18px 34px rgba(123,94,220,.14);-webkit-backdrop-filter:blur(18px) saturate(1.18);backdrop-filter:blur(18px) saturate(1.18);}",
            ".live2d-quiz.is-main-menu::before,.live2d-quiz.is-score-guess::before{content:\"\";position:absolute;left:18px;right:52px;top:10px;height:1px;background:linear-gradient(90deg,transparent,rgba(202,246,255,.78),rgba(213,178,255,.46),transparent);pointer-events:none;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__close,.live2d-quiz.is-score-guess .live2d-quiz__close{width:30px;height:30px;border-radius:999px;border:1px solid rgba(207,242,255,.72);background:rgba(9,28,54,.56);box-shadow:0 0 16px rgba(109,218,255,.22),inset 0 0 10px rgba(255,255,255,.12);color:rgba(235,250,255,.98);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__close:hover,.live2d-quiz.is-score-guess .live2d-quiz__close:hover{background:rgba(72,160,218,.5);box-shadow:0 0 22px rgba(121,223,255,.36);}",
            ".live2d-menu-header,.score-guess-header{display:grid;gap:8px;}",
            ".live2d-menu-title,.score-guess-title{font-size:20px;font-weight:800;color:rgba(237,250,255,.98);text-shadow:0 0 16px rgba(102,213,255,.32);letter-spacing:0;}",
            ".live2d-menu-user,.score-guess-account{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:5px 10px;border:1px solid rgba(179,234,255,.52);border-radius:999px;background:linear-gradient(90deg,rgba(87,185,230,.18),rgba(184,145,255,.16));color:rgba(218,244,255,.92);font-size:12px;line-height:1.35;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__menu{grid-template-columns:1fr 1fr;gap:10px;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option{position:relative;min-height:50px;justify-content:flex-start;padding:12px 14px 12px 40px;border:1px solid rgba(171,232,255,.55);border-radius:16px;background:linear-gradient(145deg,rgba(33,77,116,.66),rgba(28,48,92,.55));box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 8px 20px rgba(0,16,44,.2);font-weight:750;color:rgba(235,250,255,.98);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option::before{content:attr(data-menu-icon);position:absolute;left:13px;top:50%;transform:translateY(-50%);width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,rgba(206,250,255,.72),rgba(103,199,255,.28));box-shadow:0 0 14px rgba(133,221,255,.34);font-size:12px;color:#fff;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option:hover:not(:disabled){border-color:rgba(220,249,255,.88);background:linear-gradient(145deg,rgba(54,111,156,.78),rgba(55,68,130,.7));box-shadow:0 0 22px rgba(102,213,255,.26),inset 0 1px 0 rgba(255,255,255,.3);}",
            "@keyframes live2d-nightlake-ripple{0%{background-position:0 0,36px 0,0 0;transform:translateX(-2px);}100%{background-position:140px 0,-112px 0,0 0;transform:translateX(2px);}}",
            "@keyframes live2d-menu-starglint{0%,100%{opacity:.28;transform:translateX(-18%);}50%{opacity:.52;transform:translateX(18%);}}",
            "#ganyu-live2d-frame-shell,#ganyu-live2d-frame,#ganyu-live2d-frame-shell>.live2d-hit-area{outline:none!important;-webkit-tap-highlight-color:transparent!important;}",
            "#ganyu-live2d-frame-shell:focus,#ganyu-live2d-frame:focus,#ganyu-live2d-frame-shell>.live2d-hit-area:focus{outline:none!important;box-shadow:none!important;}",
            "#ganyu-live2d-frame-shell>.live2d-hit-area{pointer-events:auto!important;z-index:59!important;}",
            ".live2d-quiz.is-main-menu{position:fixed!important;z-index:63!important;isolation:isolate;width:min(430px,calc(100vw - 32px))!important;max-width:calc(100vw - 32px)!important;max-height:calc(100vh - 36px)!important;padding:0!important;border:0!important;border-radius:0!important;overflow:visible!important;pointer-events:auto!important;background:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;filter:drop-shadow(0 22px 42px rgba(0,8,30,.44)) drop-shadow(0 0 28px rgba(101,210,255,.22));}",
            ".live2d-quiz.is-main-menu::before{content:\"\"!important;position:absolute;z-index:0!important;left:10%!important;right:10%!important;top:-7px!important;height:24px!important;background:radial-gradient(ellipse at 50% 100%,rgba(204,244,255,.32),transparent 66%),linear-gradient(90deg,transparent,rgba(220,250,255,.58),rgba(179,218,255,.3),transparent)!important;box-shadow:0 0 16px rgba(120,210,245,.18);animation:live2d-menu-starglint 14s ease-in-out infinite;pointer-events:none!important;}",
            ".live2d-quiz.is-main-menu::after{content:\"\";position:absolute;z-index:0!important;left:7%;right:7%;bottom:-16px;height:88px;background:linear-gradient(90deg,rgba(170,224,255,0),rgba(170,224,255,.15),rgba(170,224,255,0)) 0 18px/128px 1px repeat-x,linear-gradient(90deg,rgba(215,236,255,0),rgba(215,236,255,.1),rgba(215,236,255,0)) 42px 38px/168px 1px repeat-x,radial-gradient(ellipse at 50% 100%,rgba(91,183,236,.18),transparent 70%);opacity:.62;filter:blur(.15px);mask-image:linear-gradient(to top,rgba(0,0,0,.76),rgba(0,0,0,.22),transparent);-webkit-mask-image:linear-gradient(to top,rgba(0,0,0,.76),rgba(0,0,0,.22),transparent);animation:live2d-nightlake-ripple 24s linear infinite;pointer-events:none!important;}",
            ".live2d-menu-beautiful-shell,.live2d-menu-shell--replica{position:relative;width:100%;box-sizing:border-box;pointer-events:auto;}",
            ".live2d-menu-panel{position:relative;width:100%;height:min(620px,calc(100vh - 36px));min-height:min(560px,calc(100vh - 36px));box-sizing:border-box;overflow:hidden;border:1px solid rgba(166,230,255,.76);border-radius:36px;background:radial-gradient(circle at 50% 3%,rgba(226,252,255,.18),transparent 17%),radial-gradient(circle at 16% 11%,rgba(91,210,255,.16),transparent 32%),radial-gradient(circle at 84% 16%,rgba(174,140,255,.14),transparent 34%),radial-gradient(ellipse at 50% 106%,rgba(76,198,255,.18),transparent 48%),linear-gradient(180deg,rgba(8,21,55,.9),rgba(5,15,42,.94) 56%,rgba(8,27,61,.9));box-shadow:0 0 42px rgba(88,202,255,.2),0 0 22px rgba(178,139,255,.1),inset 0 1px 0 rgba(255,255,255,.27),inset 0 0 0 1px rgba(255,255,255,.08),inset 0 -30px 56px rgba(73,170,231,.08);-webkit-backdrop-filter:blur(18px) saturate(1.16);backdrop-filter:blur(18px) saturate(1.16);}",
            ".live2d-menu-panel::before{content:\"\";position:absolute;inset:11px;z-index:1;border-radius:28px;border:1px solid rgba(202,245,255,.34);box-shadow:inset 0 0 0 1px rgba(120,214,255,.08),inset 0 0 34px rgba(107,205,255,.1);background:linear-gradient(90deg,transparent,rgba(214,247,255,.72),transparent) left 15% top 40px/70% 1px no-repeat,linear-gradient(90deg,transparent,rgba(154,213,255,.36),transparent) left 10% bottom 42px/80% 1px no-repeat,radial-gradient(circle at 11% 12%,rgba(255,255,255,.76) 0 1px,transparent 2px),radial-gradient(circle at 89% 14%,rgba(202,242,255,.72) 0 1px,transparent 2px),radial-gradient(circle at 15% 88%,rgba(192,226,255,.5) 0 1px,transparent 2px),radial-gradient(circle at 85% 87%,rgba(232,213,255,.48) 0 1px,transparent 2px);pointer-events:none;}",
            ".live2d-menu-panel::after{content:\"\";position:absolute;left:9%;right:9%;bottom:7%;z-index:1;height:34%;border-radius:0 0 28px 28px;background:repeating-linear-gradient(0deg,rgba(182,237,255,0) 0,rgba(182,237,255,0) 10px,rgba(182,237,255,.09) 11px,rgba(182,237,255,0) 16px),linear-gradient(90deg,rgba(178,228,255,0),rgba(178,228,255,.1),rgba(178,228,255,0)) 0 58%/170px 1px repeat-x,radial-gradient(ellipse at 50% 100%,rgba(93,202,255,.2),transparent 72%);opacity:.66;filter:blur(.25px);mix-blend-mode:screen;animation:live2d-beautiful-ripple 16s linear infinite;pointer-events:none;}",
            ".live2d-menu-beautiful-frame,.live2d-menu-panel__texture{position:absolute;inset:-7%;z-index:0;width:114%;height:114%;object-fit:cover;opacity:.18;filter:saturate(1.1) contrast(.92) blur(.2px);mix-blend-mode:screen;pointer-events:none;user-select:none;-webkit-user-drag:none;}",
            ".live2d-menu-panel__ornament{position:absolute;z-index:2;left:13%;right:13%;top:34px;height:22px;background:linear-gradient(90deg,transparent,rgba(197,240,255,.72),transparent) center/100% 1px no-repeat;pointer-events:none;}",
            ".live2d-menu-panel__ornament::before,.live2d-menu-panel__ornament::after{content:\"\";position:absolute;top:50%;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(125,224,255,.76) 48%,transparent 72%);box-shadow:0 0 16px rgba(119,219,255,.48);transform:translateY(-50%);}",
            ".live2d-menu-panel__ornament::before{left:0;}.live2d-menu-panel__ornament::after{right:0;}",
            ".live2d-menu-panel__moon{position:absolute;z-index:3;left:50%;top:18px;width:44px;height:44px;border-radius:50%;transform:translateX(-50%);background:radial-gradient(circle at 36% 32%,rgba(255,255,255,.92),rgba(181,233,255,.46) 50%,rgba(92,205,255,.12) 72%,transparent 73%);box-shadow:0 0 26px rgba(153,226,255,.34);pointer-events:none;}",
            ".live2d-menu-panel__moon::after{content:\"\";display:none;}",
            ".live2d-menu-beautiful-wave,.live2d-menu-panel__wave{position:absolute;left:8%;right:8%;bottom:6%;z-index:2;height:28%;border-radius:0 0 28px 28px;background:linear-gradient(90deg,rgba(170,224,255,0),rgba(170,224,255,.16),rgba(170,224,255,0)) 0 18px/150px 1px repeat-x,linear-gradient(90deg,rgba(215,236,255,0),rgba(215,236,255,.1),rgba(215,236,255,0)) 42px 42px/210px 1px repeat-x,radial-gradient(ellipse at 50% 100%,rgba(119,213,255,.13),transparent 64%);opacity:.58;filter:blur(.1px);mix-blend-mode:screen;animation:live2d-beautiful-ripple 14s linear infinite;pointer-events:none;}",
            ".live2d-menu-beautiful-content,.live2d-menu-panel__content{position:relative;z-index:4;display:flex;flex-direction:column;align-items:center;height:100%;box-sizing:border-box;padding:66px 38px 38px;pointer-events:auto;}",
            "@keyframes live2d-beautiful-ripple{0%{background-position:0 20px,48px 42px,50% 100%;transform:translateX(-2px);}100%{background-position:180px 20px,-132px 42px,50% 100%;transform:translateX(2px);}}",
            ".live2d-quiz.is-main-menu .live2d-quiz__meta{position:relative;z-index:2;margin:0 0 7px;color:rgba(205,239,255,.78);font-size:12px;font-weight:780;letter-spacing:.16em;text-align:center;text-transform:uppercase;pointer-events:auto;text-shadow:0 0 10px rgba(102,213,255,.18);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__question{position:relative;z-index:2;width:100%;margin:0 0 16px!important;pointer-events:auto;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__options{position:relative;z-index:2;pointer-events:auto!important;}",
            ".live2d-quiz.is-main-menu .live2d-menu-header{display:grid;gap:7px;text-align:center;}",
            ".live2d-quiz.is-main-menu .live2d-menu-title{font-size:26px;font-weight:820;color:rgba(239,252,255,.98);text-shadow:0 0 18px rgba(111,202,241,.38),0 2px 0 rgba(3,18,42,.24);letter-spacing:.04em;}",
            ".live2d-quiz.is-main-menu .live2d-menu-user{justify-self:center;max-width:100%;padding:5px 12px;border-color:rgba(177,226,247,.34);border-radius:999px;background:linear-gradient(90deg,rgba(64,170,225,.14),rgba(174,139,255,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 14px rgba(108,213,255,.1);font-size:11px;color:rgba(212,239,252,.82);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__menu{position:relative;z-index:2;display:grid!important;grid-template-columns:1fr!important;gap:19px!important;width:100%;max-height:min(372px,calc(100vh - 226px));overflow-y:auto;overflow-x:hidden;margin:0 auto;padding:2px 6px 2px 2px;pointer-events:auto!important;scrollbar-width:thin;scrollbar-color:rgba(151,222,255,.34) transparent;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__menu::-webkit-scrollbar{width:4px;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__menu::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(151,222,255,.28);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option{appearance:none;-webkit-appearance:none;position:relative!important;z-index:3;justify-content:center!important;width:100%;min-height:54px!important;padding:11px 50px!important;border:1px solid rgba(183,239,255,.44)!important;border-radius:999px!important;background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.13),transparent 58%),linear-gradient(90deg,rgba(119,216,255,.02),rgba(164,227,255,.16) 18%,rgba(137,213,255,.2) 50%,rgba(164,227,255,.16) 82%,rgba(119,216,255,.02))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -10px 22px rgba(67,173,239,.075),0 0 16px rgba(90,205,255,.11),0 8px 18px rgba(0,12,38,.12)!important;color:rgba(240,252,255,.98)!important;font-size:15px!important;font-weight:820!important;letter-spacing:.08em;text-align:center;overflow:hidden;pointer-events:auto!important;touch-action:manipulation;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option::before{content:attr(data-menu-icon);position:absolute;left:18px!important;top:50%;transform:translateY(-50%);width:22px!important;height:22px!important;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,rgba(247,254,255,.72),rgba(112,209,255,.18) 56%,transparent 74%)!important;box-shadow:0 0 13px rgba(139,218,255,.26)!important;font-size:10px!important;color:rgba(244,253,255,.9);pointer-events:none!important;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option::after{content:\"\";position:absolute;inset:0;background:linear-gradient(105deg,transparent 18%,rgba(222,247,255,.22) 45%,transparent 68%);opacity:0;transform:translateX(-36%);transition:opacity .18s ease,transform .36s ease;pointer-events:none!important;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(226,251,255,.82)!important;background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.2),transparent 58%),linear-gradient(90deg,rgba(174,232,255,.08),rgba(183,238,255,.26),rgba(174,232,255,.08))!important;box-shadow:0 0 24px rgba(112,204,242,.24),inset 0 1px 0 rgba(255,255,255,.24)!important;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option:hover:not(:disabled)::after{opacity:.7;transform:translateX(30%);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__close{position:absolute!important;z-index:7!important;right:22px!important;top:22px!important;width:32px!important;height:32px!important;border-color:rgba(219,242,255,.52)!important;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.34),rgba(116,185,222,.22) 44%,rgba(10,30,58,.38))!important;box-shadow:0 0 14px rgba(145,213,244,.22),inset 0 1px 0 rgba(255,255,255,.18)!important;color:rgba(244,252,255,.94)!important;pointer-events:auto!important;touch-action:manipulation;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__close:hover{background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.52),rgba(132,205,238,.46) 46%,rgba(14,42,76,.66))!important;box-shadow:0 0 18px rgba(154,224,255,.32),inset 0 1px 0 rgba(255,255,255,.28)!important;}",
            ".live2d-quiz.is-boss-auth{width:min(860px,calc(100vw - 32px))!important;max-width:calc(100vw - 32px)!important;max-height:calc(100vh - 72px)!important;overflow:auto!important;padding:18px!important;border:1px solid rgba(174,232,255,.34)!important;border-radius:28px!important;background:url(\"assets/ui/star-dust.svg\") center/190px 130px repeat,radial-gradient(circle at 18% 5%,rgba(155,228,255,.22),transparent 34%),radial-gradient(ellipse at 92% 16%,rgba(199,145,255,.2),transparent 38%),radial-gradient(ellipse at 52% 105%,rgba(86,206,255,.16),transparent 48%),linear-gradient(150deg,rgba(7,20,47,.82),rgba(8,13,34,.9))!important;box-shadow:0 26px 74px rgba(2,10,30,.5),0 0 42px rgba(96,205,255,.17),0 0 34px rgba(187,132,255,.12),inset 0 1px 0 rgba(255,255,255,.16),inset 0 -28px 56px rgba(81,76,178,.12)!important;-webkit-backdrop-filter:blur(18px) saturate(1.18);backdrop-filter:blur(18px) saturate(1.18);box-sizing:border-box!important;}",
            ".live2d-quiz.is-boss-auth::before{content:\"\";position:absolute;left:22px;right:58px;top:12px;height:1px;background:linear-gradient(90deg,transparent,rgba(235,253,255,.78),rgba(197,157,255,.35),transparent);box-shadow:0 0 18px rgba(122,222,255,.3);pointer-events:none;}",
            ".live2d-quiz.is-boss-auth::after{content:\"\";position:absolute;right:20px;bottom:18px;width:116px;height:116px;border-radius:30px;background:url(\"assets/ui/frost-corner.svg\") center/100% 100% no-repeat;opacity:.2;pointer-events:none;transform:rotate(180deg);}",
            ".live2d-quiz.is-boss-auth .live2d-quiz__close{width:32px;height:32px;border-radius:999px;border:1px solid rgba(205,243,255,.62);background:rgba(9,28,58,.62);box-shadow:0 0 18px rgba(112,219,255,.22),inset 0 1px 0 rgba(255,255,255,.16);color:rgba(238,252,255,.96);}",
            ".live2d-quiz.is-boss-auth .live2d-quiz__meta{display:inline-flex;width:max-content;max-width:100%;margin:0 auto 6px;padding:5px 12px;border:1px solid rgba(184,236,255,.46);border-radius:999px;background:linear-gradient(90deg,rgba(88,203,255,.16),rgba(190,145,255,.12));box-shadow:0 0 16px rgba(100,211,255,.12),inset 0 1px 0 rgba(255,255,255,.14);color:rgba(206,240,255,.9);font-size:12px;font-weight:820;}",
            ".live2d-quiz.is-boss-auth .live2d-quiz__question{max-width:720px;margin:0 auto 12px;color:rgba(220,239,252,.82);font-size:14px;line-height:1.7;text-align:center;}",
            ".live2d-quiz.is-boss-auth .live2d-quiz__options{width:100%;box-sizing:border-box;}",
            ".live2d-boss-auth-shell{position:relative;display:grid;grid-template-columns:minmax(210px,.82fr) minmax(320px,1.18fr);gap:18px;align-items:stretch;width:100%;box-sizing:border-box;}",
            ".live2d-boss-auth-shell::before{content:\"\";position:absolute;inset:8px 10px auto 10px;height:120px;background:url(\"assets/ui/aurora-streak.svg\") center top/92% 110px no-repeat;opacity:.58;pointer-events:none;}",
            ".live2d-boss-auth-ambient,.live2d-boss-auth-card{position:relative;z-index:1;min-width:0;border:1px solid rgba(168,229,255,.28);border-radius:24px;background:radial-gradient(circle at 16% 12%,rgba(188,243,255,.18),transparent 34%),linear-gradient(145deg,rgba(255,255,255,.075),rgba(65,138,208,.09));box-shadow:0 14px 32px rgba(0,12,40,.18),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -18px 34px rgba(80,91,190,.08);box-sizing:border-box;overflow:hidden;}",
            ".live2d-boss-auth-ambient{display:flex;flex-direction:column;justify-content:space-between;gap:18px;padding:24px 22px;color:rgba(231,247,255,.92);}",
            ".live2d-boss-auth-ambient::before{content:\"\";position:absolute;left:-26px;top:-24px;width:128px;height:128px;background:url(\"assets/ui/frost-corner.svg\") left top/128px 128px no-repeat;opacity:.3;pointer-events:none;}",
            ".live2d-boss-auth-kicker{display:inline-flex;width:max-content;max-width:100%;padding:5px 11px;border:1px solid rgba(188,238,255,.38);border-radius:999px;background:rgba(91,203,255,.12);color:rgba(206,241,255,.9);font-size:12px;font-weight:820;}",
            ".live2d-boss-auth-title{margin:12px 0 0;color:rgba(248,253,255,.98);font-size:30px;font-weight:940;line-height:1.08;text-shadow:0 0 20px rgba(117,219,255,.28);}",
            ".live2d-boss-auth-copy{margin:12px 0 0;color:rgba(207,231,248,.82);font-size:13px;line-height:1.75;}",
            ".live2d-boss-auth-notes{display:grid;gap:8px;margin:0;padding:0;list-style:none;}",
            ".live2d-boss-auth-notes li{position:relative;padding:8px 10px 8px 30px;border:1px solid rgba(172,229,255,.18);border-radius:14px;background:rgba(9,31,64,.24);color:rgba(221,241,253,.84);font-size:12px;line-height:1.45;}",
            ".live2d-boss-auth-notes li::before{content:\"\";position:absolute;left:11px;top:13px;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(115,220,255,.9) 45%,rgba(177,136,255,.4));box-shadow:0 0 12px rgba(118,221,255,.4);}",
            ".live2d-boss-auth-card{display:grid;gap:14px;padding:24px;}",
            ".live2d-boss-auth-heading{display:grid;gap:8px;text-align:left;}",
            ".live2d-boss-auth-heading__eyebrow{color:rgba(184,225,245,.78);font-size:12px;font-weight:780;}",
            ".live2d-boss-auth-heading__title{color:rgba(248,253,255,.98);font-size:24px;font-weight:920;line-height:1.16;text-shadow:0 0 18px rgba(117,219,255,.22);}",
            ".live2d-boss-auth-heading__desc{color:rgba(200,226,246,.78);font-size:13px;line-height:1.65;}",
            ".live2d-boss-auth-fields{display:grid;gap:12px;}",
            ".live2d-boss-auth-field{display:grid;gap:7px;min-width:0;}",
            ".live2d-boss-auth-label{color:rgba(202,232,248,.82);font-size:12px;font-weight:780;}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-input{appearance:none;-webkit-appearance:none;width:100%;min-height:48px;padding:12px 14px 12px 42px;border:1px solid rgba(171,231,255,.34);border-radius:16px;background:radial-gradient(circle at 12% 16%,rgba(173,235,255,.14),transparent 34%),linear-gradient(145deg,rgba(11,35,71,.64),rgba(14,25,59,.58));box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 10px 20px rgba(0,12,38,.12);color:rgba(241,251,255,.96);font:inherit;font-size:14px;box-sizing:border-box;outline:none;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease;}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-input::placeholder{color:rgba(175,210,232,.54);}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-input:hover{border-color:rgba(201,244,255,.54);box-shadow:0 0 18px rgba(105,213,255,.12),inset 0 1px 0 rgba(255,255,255,.18);}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-input:focus{border-color:rgba(223,250,255,.78);box-shadow:0 0 22px rgba(111,220,255,.22),0 0 18px rgba(190,142,255,.12),inset 0 1px 0 rgba(255,255,255,.22);background:linear-gradient(145deg,rgba(17,48,88,.72),rgba(16,28,68,.64));}",
            ".live2d-boss-auth-field{position:relative;}",
            ".live2d-boss-auth-field::before{content:attr(data-icon);position:absolute;left:14px;bottom:14px;z-index:1;color:rgba(196,238,255,.78);font-size:15px;text-shadow:0 0 10px rgba(111,220,255,.24);pointer-events:none;}",
            ".live2d-boss-auth-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:2px;}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-action{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:128px;padding:10px 16px;border-radius:999px;border:1px solid rgba(175,230,255,.42);background:linear-gradient(135deg,rgba(40,96,154,.52),rgba(27,50,102,.56));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 0 14px rgba(96,204,255,.1);color:rgba(240,252,255,.96);font:inherit;font-size:14px;font-weight:850;white-space:nowrap;cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease;}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-action:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(224,249,255,.72);box-shadow:0 0 20px rgba(101,211,255,.2),inset 0 1px 0 rgba(255,255,255,.22);}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-action:active:not(:disabled){transform:translateY(0);box-shadow:inset 0 1px 8px rgba(0,14,42,.24);}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-action:disabled{opacity:1;filter:none;color:rgba(224,244,255,.68);background:linear-gradient(135deg,rgba(42,82,126,.38),rgba(24,45,82,.44));cursor:default;}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-primary{flex:1 1 190px;border-color:rgba(195,243,255,.72);background:linear-gradient(135deg,rgba(92,210,255,.82),rgba(176,123,255,.7));box-shadow:0 0 24px rgba(103,213,255,.28),inset 0 1px 0 rgba(255,255,255,.28);}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-secondary{background:linear-gradient(135deg,rgba(35,82,136,.48),rgba(35,45,100,.5));}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-ghost{min-width:96px;border-color:rgba(164,213,244,.26);background:rgba(13,31,64,.32);color:rgba(212,235,250,.82);}",
            ".live2d-boss-auth-hint{margin:0;padding:10px 12px;border:1px solid rgba(168,226,255,.18);border-radius:15px;background:linear-gradient(90deg,transparent,rgba(95,184,240,.08),transparent);color:rgba(190,224,244,.78);font-size:12px;line-height:1.55;text-align:center;}",
            ".live2d-quiz.is-boss-auth .live2d-boss-auth-note{margin-top:12px;border-color:rgba(170,226,255,.22);background:linear-gradient(90deg,rgba(33,84,132,.22),rgba(108,88,184,.18));color:rgba(216,239,252,.88);}",
            "@media (max-width:720px){.live2d-quiz.is-boss-auth{width:min(92vw,520px)!important;max-width:calc(100vw - 24px)!important;max-height:calc(100vh - 88px)!important;padding:12px!important;border-radius:22px!important;}.live2d-boss-auth-shell{grid-template-columns:1fr!important;gap:12px;}.live2d-boss-auth-ambient{padding:18px;}.live2d-boss-auth-title{font-size:24px;}.live2d-boss-auth-card{padding:18px;}.live2d-boss-auth-actions{display:grid;grid-template-columns:1fr;}.live2d-quiz.is-boss-auth .live2d-boss-auth-action{width:100%;min-width:0;}.live2d-quiz.is-boss-auth::after{opacity:.12;width:92px;height:92px;}}",
            ".live2d-quiz.is-checkin{width:min(880px,calc(100vw - 32px))!important;max-width:calc(100vw - 32px)!important;max-height:calc(100vh - 72px)!important;overflow:auto!important;padding:18px!important;border:1px solid rgba(174,232,255,.38)!important;border-radius:28px!important;background:url(\"assets/ui/star-dust.svg\") center/190px 130px repeat,radial-gradient(circle at 18% 5%,rgba(155,228,255,.22),transparent 34%),radial-gradient(ellipse at 92% 16%,rgba(199,145,255,.2),transparent 38%),linear-gradient(150deg,rgba(7,20,47,.84),rgba(8,13,34,.92))!important;box-shadow:0 26px 74px rgba(2,10,30,.5),0 0 42px rgba(96,205,255,.17),inset 0 1px 0 rgba(255,255,255,.16)!important;box-sizing:border-box!important;}",
            ".live2d-checkin-panel,.live2d-checkin-shell{display:grid;gap:14px;width:100%;box-sizing:border-box;}",
            ".live2d-checkin-main,.live2d-checkin-layout{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(320px,360px)!important;gap:18px;align-items:start;width:100%;box-sizing:border-box;}",
            ".live2d-checkin-left,.live2d-checkin-info{display:grid;gap:12px;min-width:0;}",
            ".live2d-checkin-hero{position:relative;display:grid;gap:7px;padding:15px 16px;border:1px solid rgba(172,229,255,.26);border-radius:22px;background:radial-gradient(circle at 12% 10%,rgba(178,239,255,.18),transparent 34%),linear-gradient(145deg,rgba(255,255,255,.08),rgba(78,145,218,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 14px 28px rgba(0,12,42,.16);overflow:hidden;}",
            ".live2d-checkin-hero::after{content:\"\";position:absolute;right:-26px;top:-30px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(202,246,255,.22),transparent 62%);pointer-events:none;}",
            ".live2d-checkin-kicker{display:inline-flex;width:max-content;max-width:100%;padding:4px 10px;border:1px solid rgba(188,238,255,.36);border-radius:999px;background:rgba(91,203,255,.1);color:rgba(190,226,244,.76);font-size:11px;font-weight:780;}",
            ".live2d-checkin-title{margin:0;color:rgba(248,253,255,.98);font-size:25px;font-weight:920;line-height:1.16;text-shadow:0 0 18px rgba(117,219,255,.24);}",
            ".live2d-checkin-copy{margin:0;color:rgba(202,229,246,.82);font-size:13px;line-height:1.55;}",
            ".live2d-checkin-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;}",
            ".live2d-checkin-stat{display:grid;gap:4px;min-width:0;padding:12px;border:1px solid rgba(164,223,255,.28);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(67,133,201,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.13);}",
            ".live2d-checkin-stat span{color:rgba(190,224,244,.78);font-size:12px;font-weight:760;}",
            ".live2d-checkin-stat strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(246,253,255,.98);font-size:18px;font-weight:920;}",
            ".live2d-checkin-rules{display:grid;grid-template-columns:1fr;gap:8px;margin:0;padding:0;list-style:none;}",
            ".live2d-checkin-rules li{position:relative;min-width:0;padding:9px 10px 9px 28px;border:1px solid rgba(172,229,255,.2);border-radius:14px;background:rgba(9,31,64,.25);color:rgba(221,241,253,.86);font-size:12px;line-height:1.45;}",
            ".live2d-checkin-rules li::before{content:\"\";position:absolute;left:11px;top:14px;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(115,220,255,.9) 45%,rgba(177,136,255,.4));box-shadow:0 0 12px rgba(118,221,255,.42);}",
            ".live2d-checkin-message{padding:10px 12px;border:1px solid rgba(168,226,255,.2);border-radius:15px;background:linear-gradient(90deg,rgba(47,112,166,.14),rgba(102,88,184,.1));color:rgba(212,238,252,.9);font-size:12px;line-height:1.55;text-align:center;}",
            ".live2d-checkin-calendar,.live2d-checkin-calendar-card{display:grid;gap:10px;width:100%;max-width:360px;justify-self:end;padding:14px;border:1px solid rgba(168,226,255,.26);border-radius:20px;background:radial-gradient(circle at 16% 8%,rgba(180,240,255,.14),transparent 34%),linear-gradient(145deg,rgba(12,34,66,.52),rgba(21,31,70,.42));box-shadow:0 16px 32px rgba(0,12,40,.18),inset 0 1px 0 rgba(255,255,255,.14);box-sizing:border-box;}",
            ".live2d-checkin-calendar__head{display:flex;align-items:center;justify-content:space-between;gap:12px;color:rgba(233,249,255,.96);font-size:14px;font-weight:860;}",
            ".live2d-checkin-calendar__status{padding:4px 9px;border:1px solid rgba(185,235,255,.4);border-radius:999px;background:rgba(98,198,255,.12);color:rgba(203,238,255,.92);font-size:12px;font-weight:780;}",
            ".live2d-checkin-weekdays,.live2d-checkin-days,.live2d-checkin-calendar-grid{display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:6px;width:100%;}",
            ".live2d-checkin-weekdays span{display:grid;place-items:center;min-width:0;color:rgba(178,211,232,.72);font-size:11px;text-align:center;line-height:1;}",
            ".live2d-checkin-day{position:relative;display:grid;grid-template-rows:auto 10px;place-items:center;gap:2px;min-width:0;aspect-ratio:1/1;border:1px solid rgba(160,220,255,.16);border-radius:11px;background:rgba(7,23,52,.28);color:rgba(220,239,252,.84);font-size:12px;font-weight:780;line-height:1;box-sizing:border-box;overflow:hidden;}",
            ".live2d-checkin-day.is-empty{visibility:hidden;pointer-events:none;}",
            ".live2d-checkin-day.is-signed{border-color:rgba(191,243,255,.66);background:linear-gradient(145deg,rgba(85,205,255,.3),rgba(158,117,255,.24));box-shadow:0 0 14px rgba(99,212,255,.2),inset 0 1px 0 rgba(255,255,255,.18);color:rgba(244,253,255,.98);}",
            ".live2d-checkin-day.is-today{border-color:rgba(255,236,178,.7);box-shadow:0 0 18px rgba(255,220,126,.18),inset 0 1px 0 rgba(255,255,255,.18);}",
            ".live2d-checkin-day__num{position:relative;z-index:1;}",
            ".live2d-checkin-day__mark{display:block;width:6px;height:6px;border-radius:999px;background:rgba(105,219,255,.92);box-shadow:0 0 10px rgba(105,219,255,.62);opacity:0;}",
            ".live2d-checkin-day.is-signed .live2d-checkin-day__mark{opacity:1;}",
            ".live2d-checkin-day.is-today .live2d-checkin-day__mark{background:rgba(255,232,158,.96);box-shadow:0 0 10px rgba(255,224,130,.64);opacity:1;}",
            ".live2d-checkin-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-start;}",
            ".live2d-quiz.is-checkin button.live2d-checkin-action{appearance:none!important;-webkit-appearance:none!important;display:inline-flex!important;align-items:center;justify-content:center;min-height:44px;min-width:128px;padding:10px 16px;border:1px solid rgba(175,230,255,.44)!important;border-radius:999px!important;background:linear-gradient(135deg,rgba(40,96,154,.52),rgba(27,50,102,.56))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 0 14px rgba(96,204,255,.1)!important;color:rgba(240,252,255,.96)!important;font:inherit;font-size:14px;font-weight:850;white-space:nowrap;cursor:pointer;}",
            ".live2d-quiz.is-checkin button.live2d-checkin-action--primary{flex:1 1 190px;max-width:280px;border-color:rgba(195,243,255,.72)!important;background:linear-gradient(135deg,rgba(92,210,255,.82),rgba(176,123,255,.72))!important;box-shadow:0 0 24px rgba(103,213,255,.28),inset 0 1px 0 rgba(255,255,255,.28)!important;}",
            ".live2d-quiz.is-checkin button.live2d-checkin-action:disabled{opacity:1;filter:none;color:rgba(224,244,255,.68)!important;background:linear-gradient(135deg,rgba(42,82,126,.38),rgba(24,45,82,.44))!important;cursor:default;}",
            "@media (max-width:720px){.live2d-quiz.is-checkin{width:min(92vw,520px)!important;max-width:calc(100vw - 24px)!important;max-height:calc(100vh - 88px)!important;padding:12px!important;border-radius:22px!important;}.live2d-checkin-main,.live2d-checkin-layout{grid-template-columns:1fr!important;gap:12px;}.live2d-checkin-stats,.live2d-checkin-rules{grid-template-columns:1fr!important;}.live2d-checkin-calendar,.live2d-checkin-calendar-card{max-width:100%;justify-self:stretch;padding:12px;}.live2d-checkin-weekdays,.live2d-checkin-days,.live2d-checkin-calendar-grid{gap:5px;}.live2d-checkin-day{border-radius:10px;font-size:11px;}.live2d-checkin-actions{display:grid;grid-template-columns:1fr;}.live2d-quiz.is-checkin button.live2d-checkin-action{width:100%;min-width:0;max-width:none;}}",
            ".score-guess-header{padding:2px 0 4px;}",
            ".score-guess-kicker{width:max-content;padding:4px 10px;border:1px solid rgba(180,235,255,.56);border-radius:999px;background:rgba(103,202,255,.16);color:rgba(199,239,255,.96);font-size:12px;font-weight:700;}",
            ".score-guess-subtitle{color:rgba(218,237,255,.86);font-size:13px;line-height:1.55;}",
            ".score-guess-pill{display:inline-flex;width:max-content;padding:5px 10px;border-radius:999px;border:1px solid rgba(185,231,255,.52);background:linear-gradient(90deg,rgba(78,192,255,.22),rgba(184,139,255,.18));color:rgba(235,250,255,.94);font-size:12px;font-weight:750;}",
            ".score-guess-status{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:2px;}",
            ".score-guess-status__item{padding:9px 10px;border:1px solid rgba(164,223,255,.42);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(91,173,233,.12));color:rgba(224,244,255,.92);font-size:12px;line-height:1.45;}",
            ".score-guess-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}",
            ".score-guess-option{position:relative;min-height:78px;text-align:left;overflow:hidden;border-radius:17px!important;padding:13px 13px 12px 48px!important;}",
            ".score-guess-option::before{content:\"\";position:absolute;left:14px;top:16px;width:22px;height:22px;border-radius:999px;background:var(--score-dot,rgba(170,216,255,.62));box-shadow:0 0 18px var(--score-glow,rgba(139,218,255,.38));}",
            ".score-guess-option::after{content:\"\";position:absolute;right:-18px;bottom:-22px;width:72px;height:72px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),transparent 64%);pointer-events:none;}",
            ".score-guess-option--bronze{--score-dot:linear-gradient(135deg,#ffe0ae,#b87835);--score-glow:rgba(225,147,65,.42);}",
            ".score-guess-option--silver{--score-dot:linear-gradient(135deg,#ffffff,#9fc2da);--score-glow:rgba(212,239,255,.46);}",
            ".score-guess-option--gold{--score-dot:linear-gradient(135deg,#fff7a8,#f0b332);--score-glow:rgba(255,210,68,.5);}",
            ".score-guess-option--top{--score-dot:radial-gradient(circle,#fff,#b891ff 45%,#64d6ff);--score-glow:rgba(188,137,255,.5);}",
            ".score-guess-option--none{--score-dot:linear-gradient(135deg,#c8d4e8,#6681a9);--score-glow:rgba(132,161,204,.36);}",
            ".score-guess-option .score-guess-option__name{display:block;color:rgba(245,252,255,.98);font-size:16px;font-weight:850;}",
            ".score-guess-option .score-guess-option__count{display:block;margin-top:5px;color:rgba(202,229,245,.86);font-size:12px;}",
            ".score-guess-option .score-guess-option__mark{display:inline-flex;margin-top:8px;padding:3px 8px;border-radius:999px;background:rgba(125,229,255,.18);border:1px solid rgba(181,243,255,.62);color:rgba(234,252,255,.98);font-size:11px;font-weight:800;}",
            ".score-guess-option.is-selected{border-color:rgba(224,250,255,.94)!important;background:linear-gradient(145deg,rgba(74,151,204,.82),rgba(95,70,158,.72))!important;box-shadow:0 0 26px rgba(112,221,255,.36),inset 0 0 18px rgba(255,255,255,.13)!important;}",
            ".score-guess-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:2px;}",
            ".score-guess-actions .live2d-quiz__option{min-height:42px;border-radius:13px;}",
            ".score-guess-actions .score-guess-action--primary{border-color:rgba(191,243,255,.82);background:linear-gradient(135deg,rgba(75,202,255,.78),rgba(160,112,255,.72));box-shadow:0 0 18px rgba(98,210,255,.28);}",
            ".score-guess-actions .score-guess-action--danger{border-color:rgba(255,198,216,.82);background:linear-gradient(135deg,rgba(245,105,156,.68),rgba(132,94,220,.68));}",
            ".score-guess-actions .score-guess-action--soft{background:rgba(32,65,104,.58);}",
            ".live2d-quiz.is-score-guess{background:radial-gradient(circle at 18% 0%,rgba(129,224,255,.34),transparent 34%),radial-gradient(circle at 94% 8%,rgba(209,160,255,.24),transparent 34%),linear-gradient(150deg,rgba(14,35,67,.94),rgba(27,61,101,.86) 48%,rgba(39,44,92,.88));box-shadow:0 20px 56px rgba(1,14,38,.58),0 0 40px rgba(94,207,255,.28),0 0 26px rgba(169,117,255,.18),inset 0 1px 0 rgba(255,255,255,.28),inset 0 -24px 44px rgba(93,74,184,.16);}",
            ".live2d-quiz.is-score-guess::after{content:\"\";position:absolute;right:20px;bottom:18px;width:86px;height:86px;border-radius:28px;background:linear-gradient(135deg,rgba(206,246,255,.12),rgba(168,129,255,.08));box-shadow:inset 0 0 0 1px rgba(215,247,255,.2);transform:rotate(12deg);pointer-events:none;}",
            ".score-guess-panel{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;}",
            ".score-guess-panel__header{position:relative;display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:start;padding:14px 16px;border:1px solid rgba(172,232,255,.42);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(108,196,255,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.22);}",
            ".score-guess-panel__header::before{content:\"\";position:absolute;left:18px;right:18px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(224,250,255,.8),transparent);}",
            ".score-guess-panel__heading{display:grid;gap:7px;min-width:0;}",
            ".score-guess-panel__badge{width:max-content;padding:4px 10px;border-radius:999px;border:1px solid rgba(181,236,255,.6);background:rgba(92,201,255,.17);color:rgba(211,243,255,.96);font-size:12px;font-weight:750;}",
            ".score-guess-panel__state{justify-self:end;align-self:start;white-space:nowrap;padding:6px 11px;border-radius:999px;border:1px solid rgba(196,236,255,.58);background:linear-gradient(90deg,rgba(78,192,255,.24),rgba(184,139,255,.2));color:rgba(238,252,255,.96);font-size:12px;font-weight:850;box-shadow:0 0 16px rgba(100,211,255,.16);}",
            ".score-guess-panel__title{font-size:22px;font-weight:900;color:rgba(244,252,255,.98);text-shadow:0 0 18px rgba(111,218,255,.32);line-height:1.12;}",
            ".score-guess-panel__subtitle{color:rgba(214,237,255,.88);font-size:13px;line-height:1.55;}",
            ".score-guess-panel__meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:11px;border:1px solid rgba(158,222,255,.42);border-radius:17px;background:linear-gradient(145deg,rgba(8,30,58,.38),rgba(96,174,232,.12));}",
            ".score-guess-panel__meta-item{min-width:0;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.075);box-shadow:inset 0 1px 0 rgba(255,255,255,.14);}",
            ".score-guess-panel__meta-label{display:block;margin-bottom:4px;color:rgba(179,222,242,.82);font-size:11px;}",
            ".score-guess-panel__meta-value{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(242,252,255,.98);font-size:13px;font-weight:850;}",
            ".score-guess-panel__options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;}",
            ".score-guess-panel__options .score-guess-option--wide{grid-column:1/-1;}",
            ".score-guess-option{min-height:92px;padding:15px 14px 13px 54px!important;background:radial-gradient(circle at 95% 18%,rgba(255,255,255,.12),transparent 34%),linear-gradient(145deg,rgba(255,255,255,.1),rgba(70,135,190,.12))!important;border:1px solid rgba(165,228,255,.46)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 12px 22px rgba(0,12,38,.18)!important;}",
            ".score-guess-option::before{left:16px;top:17px;width:26px;height:26px;}",
            ".score-guess-option .score-guess-option__name{font-size:17px;line-height:1.2;}",
            ".score-guess-option .score-guess-option__count{margin-top:7px;font-size:12px;}",
            ".score-guess-option .score-guess-option__mark{position:absolute;right:12px;top:11px;margin:0;}",
            ".score-guess-option:hover:not(:disabled){border-color:rgba(221,250,255,.88)!important;box-shadow:0 0 22px rgba(105,217,255,.25),inset 0 1px 0 rgba(255,255,255,.25)!important;}",
            ".score-guess-option.score-guess-option--selected{border-color:rgba(224,250,255,.94)!important;background:linear-gradient(145deg,rgba(74,151,204,.82),rgba(95,70,158,.72))!important;box-shadow:0 0 26px rgba(112,221,255,.36),inset 0 0 18px rgba(255,255,255,.13)!important;}",
            ".score-guess-option:disabled{cursor:default;}",
            ".score-guess-panel__actions{display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end;padding:11px;border:1px solid rgba(154,217,255,.34);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(90,165,224,.1));}",
            ".score-guess-panel__actions .score-guess-action--soft:last-child{opacity:.82;}",
            ".score-guess-panel__footer-note{padding:10px 12px;border:1px solid rgba(169,226,255,.34);border-radius:14px;background:rgba(11,31,59,.36);color:rgba(220,240,255,.88);font-size:12px;line-height:1.5;}",
            "@media (max-width:768px){.live2d-quiz.is-main-menu .live2d-quiz__menu,.score-guess-grid,.score-guess-status,.score-guess-actions{grid-template-columns:1fr;}.live2d-menu-title,.score-guess-title{font-size:18px;}.live2d-menu-user,.score-guess-account,.score-guess-pill{font-size:11px;}.score-guess-option{min-height:70px;padding-left:44px!important;}.score-guess-option::before{left:13px;top:15px;width:20px;height:20px;}.score-guess-panel__header{grid-template-columns:1fr;}.score-guess-panel__state{justify-self:start;}.score-guess-panel__meta{grid-template-columns:1fr;}.score-guess-panel__options{grid-template-columns:1fr;}.score-guess-panel__actions{display:grid;grid-template-columns:1fr;}.score-guess-panel__actions .live2d-quiz__option{width:100%;min-width:0;}.score-guess-panel__title{font-size:20px;}}",
            "@media (max-width:768px){.live2d-quiz.is-main-menu{width:min(92vw,420px)!important;max-width:calc(100vw - 24px)!important;max-height:calc(100vh - 88px)!important;padding:0!important;}.live2d-menu-panel{height:min(560px,calc(100vh - 88px));min-height:0;border-radius:28px;}.live2d-menu-panel::before{inset:9px;border-radius:22px;}.live2d-menu-panel::after{opacity:.5;height:30%;}.live2d-menu-panel__ornament{left:16%;right:16%;top:28px;}.live2d-menu-panel__moon{top:12px;width:38px;height:38px;}.live2d-menu-panel__moon::after{display:none;}.live2d-menu-beautiful-content,.live2d-menu-panel__content{padding:54px 26px 30px;}.live2d-quiz.is-main-menu .live2d-quiz__question{margin-bottom:13px!important;}.live2d-quiz.is-main-menu .live2d-menu-title{font-size:22px;}.live2d-quiz.is-main-menu .live2d-menu-user{font-size:11px;padding:5px 10px;}.live2d-quiz.is-main-menu .live2d-quiz__menu{grid-template-columns:1fr!important;gap:15px!important;width:100%;max-height:258px;}.live2d-quiz.is-main-menu .live2d-quiz__option{width:100%;min-width:0;min-height:46px!important;padding:9px 44px!important;font-size:13px!important;}.live2d-quiz.is-main-menu .live2d-quiz__option::before{left:14px!important;width:20px!important;height:20px!important;}.live2d-quiz.is-main-menu .live2d-quiz__close{right:18px!important;top:18px!important;width:30px!important;height:30px!important;}.live2d-quiz.is-main-menu::after{height:64px;opacity:.5;}}",
            "@media (prefers-reduced-motion:reduce){.live2d-quiz.is-main-menu::before,.live2d-quiz.is-main-menu::after,.live2d-quiz.is-main-menu .live2d-quiz__option::after,.live2d-menu-beautiful-wave,.live2d-menu-panel::after{animation:none!important;transition:none!important;}.live2d-menu-beautiful-wave,.live2d-menu-panel::after{opacity:.22;}.live2d-quiz.is-main-menu::after{opacity:.28;}.live2d-quiz.is-main-menu .live2d-quiz__option:hover:not(:disabled){transform:none;}}",
            "html.performance-low .live2d-quiz.is-main-menu,html.performance-low .live2d-quiz.is-score-guess{box-shadow:0 12px 28px rgba(3,18,42,.38),inset 0 1px 0 rgba(255,255,255,.18);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);}",
            ".live2d-quiz.is-score-guess .live2d-quiz__question:empty{display:none;}",
            ".live2d-quiz.is-score-guess{width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow:auto;padding:24px!important;box-sizing:border-box;}",
            ".live2d-quiz.is-score-guess .score-guess-shell{display:block!important;width:100%!important;box-sizing:border-box;}",
            ".live2d-quiz.is-score-guess .live2d-quiz__result:empty{display:none;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{position:relative;display:flex!important;flex-direction:column!important;gap:16px!important;width:100%!important;box-sizing:border-box;padding:24px!important;border:1px solid rgba(178,237,255,.72);border-radius:26px;background:radial-gradient(circle at 50% -12%,rgba(126,218,255,.28),transparent 34%),radial-gradient(circle at 92% 18%,rgba(178,124,255,.2),transparent 32%),linear-gradient(150deg,rgba(6,22,48,.82),rgba(18,52,91,.64) 52%,rgba(25,35,78,.68));box-shadow:0 24px 58px rgba(0,10,34,.36),0 0 34px rgba(91,204,255,.26),inset 0 1px 0 rgba(255,255,255,.24),inset 0 -26px 54px rgba(74,84,184,.16);overflow:hidden;color:rgba(238,250,255,.96);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]::before{content:\"\";position:absolute;left:32px;right:32px;top:0;height:2px;background:linear-gradient(90deg,transparent,rgba(225,252,255,.92),rgba(167,217,255,.82),transparent);box-shadow:0 0 16px rgba(117,218,255,.58);pointer-events:none;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]::after{content:\"\";position:absolute;right:-34px;top:120px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(121,211,255,.14),transparent 62%);pointer-events:none;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header{display:grid!important;grid-template-columns:1fr auto!important;gap:10px 16px!important;align-items:start!important;padding:0 0 2px!important;border:0!important;background:transparent!important;box-shadow:none!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__heading{display:grid!important;gap:8px!important;min-width:0;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__eyebrow{display:inline-flex;width:max-content;align-items:center;gap:6px;padding:5px 11px;border:1px solid rgba(179,235,255,.62);border-radius:999px;background:linear-gradient(90deg,rgba(85,202,255,.2),rgba(190,143,255,.14));color:rgba(209,244,255,.98);font-size:12px;font-weight:850;box-shadow:0 0 16px rgba(99,211,255,.18);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title-row{display:flex;align-items:center;flex-wrap:wrap;gap:12px;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title{margin:0;font-size:32px;font-weight:940;line-height:1.05;letter-spacing:.01em;color:rgba(246,253,255,.99);text-shadow:0 0 18px rgba(112,217,255,.34),0 2px 0 rgba(12,34,62,.22);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__status-pill{align-self:start;white-space:nowrap;padding:8px 14px;border-radius:999px;border:1px solid rgba(194,241,255,.72);background:linear-gradient(90deg,rgba(79,191,255,.28),rgba(184,139,255,.22));box-shadow:0 0 18px rgba(100,211,255,.2),inset 0 1px 0 rgba(255,255,255,.22);color:rgba(241,253,255,.98);font-size:13px;font-weight:880;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__question{color:rgba(242,252,255,.98);font-size:17px;font-weight:850;line-height:1.38;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__desc{max-width:620px;color:rgba(201,229,247,.82);font-size:13px;line-height:1.65;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item{position:relative;display:grid!important;grid-template-columns:42px 1fr;align-items:center;gap:11px;min-width:0;padding:13px 14px!important;border:1px solid rgba(155,222,255,.45);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(84,162,224,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 10px 22px rgba(0,13,39,.16);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:999px;border:1px solid rgba(194,242,255,.66);background:radial-gradient(circle at 35% 24%,rgba(255,255,255,.9),rgba(91,203,255,.72) 38%,rgba(58,96,222,.72));box-shadow:0 0 20px rgba(104,211,255,.35),inset 0 1px 0 rgba(255,255,255,.38);color:#fff;font-size:18px;font-weight:900;text-shadow:0 1px 6px rgba(0,18,42,.42);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-label{display:block;margin:0 0 4px;color:rgba(181,224,244,.82);font-size:12px;font-weight:720;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-value{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(246,253,255,.99);font-size:16px;font-weight:900;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:13px!important;width:100%!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{position:relative;display:grid!important;grid-template-columns:58px 1fr auto;align-items:center;gap:14px;width:100%!important;min-height:92px!important;padding:16px!important;border:1px solid var(--score-border,rgba(169,230,255,.52))!important;border-radius:18px!important;background:radial-gradient(circle at 92% 18%,var(--score-soft,rgba(255,255,255,.13)),transparent 36%),linear-gradient(145deg,rgba(255,255,255,.1),rgba(52,113,178,.14))!important;box-shadow:0 13px 24px rgba(0,11,38,.2),0 0 20px var(--score-glow,rgba(110,210,255,.16)),inset 0 1px 0 rgba(255,255,255,.2)!important;color:rgba(242,252,255,.98)!important;text-align:left!important;box-sizing:border-box!important;opacity:1!important;filter:none!important;overflow:hidden;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option::before,.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option::after{content:none!important;display:none!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(232,253,255,.94)!important;box-shadow:0 0 28px var(--score-glow,rgba(110,210,255,.3)),inset 0 1px 0 rgba(255,255,255,.3)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option:disabled{opacity:1!important;cursor:default!important;color:inherit!important;filter:none!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--selected{border-color:rgba(234,253,255,.98)!important;background:radial-gradient(circle at 88% 18%,var(--score-soft,rgba(255,255,255,.2)),transparent 38%),linear-gradient(145deg,rgba(74,151,204,.88),rgba(94,72,160,.78))!important;box-shadow:0 0 30px var(--score-glow,rgba(112,221,255,.4)),inset 0 0 18px rgba(255,255,255,.16)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--wide{grid-column:1/-1!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;border:1px solid rgba(232,251,255,.64);background:var(--score-badge,linear-gradient(135deg,#dff8ff,#83d8ff));box-shadow:0 0 22px var(--score-glow,rgba(121,219,255,.3)),inset 0 1px 0 rgba(255,255,255,.44),inset 0 -10px 18px rgba(0,23,52,.16);color:#fff;font-size:19px;font-weight:950;text-shadow:0 1px 6px rgba(0,20,45,.45);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__body{display:grid;gap:7px;min-width:0;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__name{display:block;color:rgba(248,253,255,.99);font-size:20px;font-weight:920;line-height:1.08;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__count{display:block;color:rgba(208,233,248,.92);font-size:13px;font-weight:720;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__mark{align-self:start;justify-self:end;min-width:max-content;padding:5px 9px;border-radius:999px;border:1px solid rgba(190,244,255,.68);background:rgba(125,229,255,.2);color:rgba(238,253,255,.99);font-size:11px;font-weight:880;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__mark[aria-hidden=\"true\"]{visibility:hidden;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--bronze{--score-badge:linear-gradient(135deg,#ffe1b0,#d58b48 54%,#8f4d2e);--score-border:rgba(255,170,107,.7);--score-glow:rgba(231,137,65,.36);--score-soft:rgba(231,137,65,.2);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--silver{--score-badge:linear-gradient(135deg,#ffffff,#c9e7f8 50%,#7fa8c4);--score-border:rgba(207,237,255,.72);--score-glow:rgba(207,237,255,.36);--score-soft:rgba(207,237,255,.18);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--gold{--score-badge:linear-gradient(135deg,#fff8b2,#f0bf3d 52%,#b66f20);--score-border:rgba(255,218,92,.72);--score-glow:rgba(255,204,66,.36);--score-soft:rgba(255,204,66,.18);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--top{--score-badge:radial-gradient(circle at 35% 25%,#fff,#c79aff 45%,#5ddcff 78%);--score-border:rgba(186,139,255,.72);--score-glow:rgba(177,116,255,.4);--score-soft:rgba(177,116,255,.22);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--none{--score-badge:linear-gradient(135deg,#d8e6f5,#8099bd 52%,#506686);--score-border:rgba(151,178,214,.66);--score-glow:rgba(132,161,204,.26);--score-soft:rgba(132,161,204,.16);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;gap:11px!important;width:100%!important;padding:13px!important;border:1px solid rgba(154,217,255,.38)!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(88,162,224,.11))!important;box-sizing:border-box!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{display:inline-flex;align-items:center;justify-content:center;min-width:136px;min-height:44px;padding:10px 16px;border-radius:999px;border:1px solid rgba(175,230,255,.62);background:rgba(32,65,104,.58);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);color:rgba(240,252,255,.98);font-size:14px;font-weight:850;line-height:1.2;cursor:pointer;white-space:nowrap;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action:hover{transform:translateY(-1px);border-color:rgba(224,250,255,.88);box-shadow:0 0 18px rgba(101,211,255,.22),inset 0 1px 0 rgba(255,255,255,.24);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--primary{border-color:rgba(191,243,255,.86);background:linear-gradient(135deg,rgba(76,202,255,.86),rgba(160,112,255,.76));box-shadow:0 0 20px rgba(98,210,255,.3),inset 0 1px 0 rgba(255,255,255,.26);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--danger{border-color:rgba(255,198,216,.86);background:linear-gradient(135deg,rgba(245,105,156,.72),rgba(132,94,220,.72));}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--soft{opacity:.9;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__footer-note{padding:11px 13px!important;border:1px solid rgba(169,226,255,.36)!important;border-radius:15px!important;background:rgba(11,31,59,.4)!important;color:rgba(220,240,255,.9)!important;font-size:13px!important;line-height:1.55!important;}",
            "@media (max-width:768px){.live2d-quiz.is-score-guess{width:min(92vw,calc(100vw - 24px));max-height:calc(100vh - 72px);padding:14px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{gap:13px!important;padding:15px!important;border-radius:22px;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header,.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta,.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{grid-template-columns:1fr!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__status-pill{justify-self:start;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title{font-size:25px;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{grid-template-columns:48px 1fr auto;min-height:82px!important;padding:13px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{width:48px;height:48px;border-radius:16px;font-size:17px;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__name{font-size:18px;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{display:grid!important;grid-template-columns:1fr!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{width:100%;min-width:0;}}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{gap:18px!important;max-width:min(760px,calc(100vw - 32px))!important;margin:0 auto!important;padding:30px 30px 24px!important;border-radius:28px!important;border:1px solid rgba(165,232,255,.78)!important;background:radial-gradient(circle at 50% -8%,rgba(148,228,255,.38),transparent 32%),radial-gradient(circle at 98% 10%,rgba(188,126,255,.2),transparent 28%),radial-gradient(circle at 8% 92%,rgba(88,201,255,.16),transparent 32%),linear-gradient(155deg,rgba(5,20,47,.9),rgba(16,48,86,.76) 52%,rgba(18,30,70,.82))!important;box-shadow:0 0 0 1px rgba(229,252,255,.18),0 28px 70px rgba(0,12,38,.48),0 0 42px rgba(90,205,255,.34),inset 0 1px 0 rgba(255,255,255,.3),inset 0 -34px 68px rgba(88,92,190,.18)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]::before{left:28px!important;right:28px!important;height:3px!important;background:linear-gradient(90deg,transparent,rgba(244,254,255,.98),rgba(132,221,255,.86),transparent)!important;box-shadow:0 0 24px rgba(124,225,255,.7)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]::after{right:-48px!important;top:70px!important;width:190px!important;height:190px!important;background:radial-gradient(circle,rgba(108,214,255,.18),rgba(176,130,255,.08) 42%,transparent 68%)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header{position:relative!important;display:flex!important;flex-direction:column!important;gap:10px!important;align-items:center!important;text-align:center!important;padding:2px 42px 4px!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__heading{display:flex!important;flex-direction:column!important;align-items:center!important;gap:10px!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__eyebrow{padding:6px 14px!important;background:linear-gradient(90deg,rgba(86,205,255,.24),rgba(198,151,255,.16))!important;border-color:rgba(196,242,255,.72)!important;box-shadow:0 0 18px rgba(98,211,255,.22),inset 0 1px 0 rgba(255,255,255,.24)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title-row{justify-content:center!important;gap:14px!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title{font-size:42px!important;font-weight:950!important;letter-spacing:.04em!important;text-shadow:0 0 22px rgba(118,221,255,.52),0 2px 0 rgba(8,22,48,.34)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__status-pill{padding:8px 18px!important;border-color:rgba(203,243,255,.86)!important;background:linear-gradient(90deg,rgba(82,190,255,.38),rgba(181,132,255,.26))!important;box-shadow:0 0 22px rgba(102,211,255,.3),inset 0 1px 0 rgba(255,255,255,.28)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__question{font-size:19px!important;font-weight:900!important;color:rgba(246,253,255,.99)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__desc{max-width:680px!important;margin:0 auto!important;color:rgba(203,229,247,.86)!important;font-size:14px!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item{grid-template-columns:46px 1fr!important;gap:12px!important;min-height:74px!important;padding:14px 16px!important;border-radius:17px!important;border-color:rgba(154,225,255,.58)!important;background:radial-gradient(circle at 18% 18%,rgba(113,220,255,.2),transparent 36%),linear-gradient(145deg,rgba(255,255,255,.12),rgba(71,146,210,.12))!important;box-shadow:0 12px 28px rgba(0,13,42,.2),inset 0 1px 0 rgba(255,255,255,.22)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-icon{width:46px!important;height:46px!important;background:radial-gradient(circle at 35% 25%,#fff,rgba(105,215,255,.82) 42%,rgba(61,96,225,.8))!important;box-shadow:0 0 24px rgba(104,211,255,.44),inset 0 1px 0 rgba(255,255,255,.46)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-label{font-size:12px!important;color:rgba(183,224,244,.86)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-value{font-size:17px!important;color:rgba(249,254,255,.99)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{grid-template-columns:64px 1fr auto!important;gap:15px!important;min-height:98px!important;padding:17px!important;border-radius:20px!important;background:radial-gradient(circle at 96% 12%,var(--score-soft),transparent 34%),radial-gradient(circle at 82% 78%,rgba(255,255,255,.08),transparent 36%),linear-gradient(145deg,rgba(255,255,255,.1),rgba(30,70,126,.26))!important;border-color:var(--score-border)!important;box-shadow:0 15px 32px rgba(0,10,38,.26),0 0 24px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -18px 32px rgba(0,20,60,.12)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 18px 36px rgba(0,10,38,.28),0 0 34px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.3)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option:disabled{opacity:1!important;cursor:default!important;color:inherit!important;filter:none!important;-webkit-text-fill-color:currentColor!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--selected{border-color:rgba(243,254,255,.98)!important;box-shadow:0 0 38px var(--score-glow),0 18px 36px rgba(0,10,38,.28),inset 0 0 22px rgba(255,255,255,.18)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{width:64px!important;height:64px!important;border-radius:20px!important;font-size:22px!important;border-color:rgba(240,253,255,.74)!important;box-shadow:0 0 28px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.5),inset 0 -12px 20px rgba(0,19,48,.18)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__name{font-size:22px!important;font-weight:950!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__count{font-size:14px!important;color:rgba(214,236,250,.94)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__mark{padding:6px 10px!important;background:rgba(134,232,255,.24)!important;border-color:rgba(206,248,255,.82)!important;box-shadow:0 0 14px rgba(119,225,255,.18)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--bronze{--score-badge:linear-gradient(135deg,#ffe5be,#d88947 52%,#7d3d28);--score-border:rgba(255,170,106,.82);--score-glow:rgba(232,136,64,.42);--score-soft:rgba(232,136,64,.24);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--silver{--score-badge:linear-gradient(135deg,#fff,#d8efff 48%,#7ba5c4);--score-border:rgba(216,241,255,.86);--score-glow:rgba(207,237,255,.44);--score-soft:rgba(207,237,255,.22);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--gold{--score-badge:linear-gradient(135deg,#fff9bd,#f3c23f 52%,#a7651d);--score-border:rgba(255,222,92,.86);--score-glow:rgba(255,205,66,.44);--score-soft:rgba(255,205,66,.22);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--top{--score-badge:radial-gradient(circle at 35% 24%,#fff,#ca9cff 44%,#58ddff 78%);--score-border:rgba(196,146,255,.86);--score-glow:rgba(179,116,255,.48);--score-soft:rgba(179,116,255,.28);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--none{--score-badge:linear-gradient(135deg,#dce9f7,#829bbe 52%,#4e637f);--score-border:rgba(153,184,222,.76);--score-glow:rgba(132,161,204,.32);--score-soft:rgba(132,161,204,.2);}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--wide{grid-column:1/-1!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{justify-content:center!important;gap:14px!important;padding:16px!important;border-radius:20px!important;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(80,158,221,.13))!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{min-height:48px!important;min-width:154px!important;padding:12px 18px!important;border-radius:999px!important;font-size:15px!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--primary{background:linear-gradient(135deg,rgba(87,213,255,.92),rgba(168,118,255,.82))!important;box-shadow:0 0 26px rgba(102,213,255,.38),inset 0 1px 0 rgba(255,255,255,.32)!important;}",
            ".score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__footer-note{text-align:center!important;color:rgba(195,227,247,.9)!important;background:linear-gradient(90deg,transparent,rgba(98,183,240,.12),transparent)!important;border-color:rgba(169,226,255,.28)!important;}",
            "@media (max-width:768px){.live2d-quiz.is-score-guess{width:min(92vw,calc(100vw - 24px))!important;max-height:calc(100vh - 88px)!important;padding:12px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{max-width:92vw!important;gap:13px!important;padding:16px!important;border-radius:22px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header{padding:0 34px 2px!important;align-items:flex-start!important;text-align:left!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__heading{align-items:flex-start!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title-row{justify-content:flex-start!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title{font-size:27px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__question{font-size:16px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta,.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{grid-template-columns:1fr!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item{min-height:62px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{grid-template-columns:50px 1fr auto!important;min-height:86px!important;padding:13px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{width:50px!important;height:50px!important;border-radius:16px!important;font-size:17px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__name{font-size:18px!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{display:grid!important;grid-template-columns:1fr!important;}.score-guess-panel[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{width:100%!important;min-width:0!important;}}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{display:flex!important;flex-direction:column!important;gap:14px!important;width:100%!important;max-width:820px!important;max-height:calc(100vh - 104px)!important;overflow-y:auto!important;overflow-x:hidden!important;padding:22px 24px 18px!important;border-radius:28px!important;border:1px solid rgba(177,236,255,.82)!important;background:radial-gradient(circle at 50% -10%,rgba(158,231,255,.4),transparent 33%),radial-gradient(circle at 96% 10%,rgba(191,134,255,.22),transparent 30%),linear-gradient(155deg,rgba(5,20,47,.92),rgba(16,47,86,.78) 54%,rgba(18,31,70,.84))!important;box-shadow:0 0 0 1px rgba(230,252,255,.18),0 30px 74px rgba(0,12,38,.5),0 0 48px rgba(91,207,255,.36),inset 0 1px 0 rgba(255,255,255,.32),inset 0 -34px 68px rgba(88,92,190,.18)!important;-webkit-backdrop-filter:blur(20px) saturate(1.16);backdrop-filter:blur(20px) saturate(1.16);box-sizing:border-box!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header{display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:6px!important;padding:0 42px 2px!important;border:0!important;background:transparent!important;box-shadow:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__heading{display:contents!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__eyebrow{display:inline-flex!important;width:max-content!important;align-items:center!important;gap:8px!important;padding:6px 15px!important;border-radius:999px!important;border:1px solid rgba(197,243,255,.75)!important;background:linear-gradient(90deg,rgba(86,205,255,.24),rgba(198,151,255,.16))!important;box-shadow:0 0 18px rgba(98,211,255,.24),inset 0 1px 0 rgba(255,255,255,.24)!important;color:rgba(217,246,255,.98)!important;font-size:13px!important;font-weight:860!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__eyebrow::before{content:\"✦\";color:rgba(202,244,255,.98);text-shadow:0 0 10px rgba(120,224,255,.55);}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title-row{display:flex!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap!important;gap:14px!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title{margin:0!important;font-size:42px!important;font-weight:950!important;letter-spacing:.04em!important;line-height:1.05!important;color:rgba(248,253,255,.99)!important;text-shadow:0 0 22px rgba(118,221,255,.52),0 2px 0 rgba(8,22,48,.34)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__status-pill{padding:8px 18px!important;border-radius:999px!important;border:1px solid rgba(203,243,255,.86)!important;background:linear-gradient(90deg,rgba(82,190,255,.38),rgba(181,132,255,.26))!important;box-shadow:0 0 22px rgba(102,211,255,.3),inset 0 1px 0 rgba(255,255,255,.28)!important;color:rgba(242,253,255,.99)!important;font-size:14px!important;font-weight:880!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__question{margin:0!important;color:rgba(246,253,255,.99)!important;font-size:19px!important;font-weight:900!important;line-height:1.4!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__desc{max-width:680px!important;margin:0 auto!important;color:rgba(203,229,247,.86)!important;font-size:14px!important;line-height:1.65!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item{display:grid!important;grid-template-columns:46px 1fr!important;grid-template-areas:\"icon label\" \"icon value\"!important;align-items:center!important;gap:4px 12px!important;min-width:0!important;min-height:74px!important;padding:14px 16px!important;border-radius:17px!important;border:1px solid rgba(154,225,255,.58)!important;background:radial-gradient(circle at 18% 18%,rgba(113,220,255,.2),transparent 36%),linear-gradient(145deg,rgba(255,255,255,.12),rgba(71,146,210,.12))!important;box-shadow:0 12px 28px rgba(0,13,42,.2),inset 0 1px 0 rgba(255,255,255,.22)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-icon{grid-area:icon!important;display:grid!important;place-items:center!important;width:46px!important;height:46px!important;border-radius:999px!important;border:1px solid rgba(204,244,255,.7)!important;background:radial-gradient(circle at 35% 25%,#fff,rgba(105,215,255,.82) 42%,rgba(61,96,225,.8))!important;box-shadow:0 0 24px rgba(104,211,255,.44),inset 0 1px 0 rgba(255,255,255,.46)!important;color:#fff!important;font-size:18px!important;font-weight:900!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-label{grid-area:label!important;display:block!important;margin:0!important;color:rgba(183,224,244,.86)!important;font-size:12px!important;font-weight:760!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-value{grid-area:value!important;display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:rgba(249,254,255,.99)!important;font-size:17px!important;font-weight:920!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important;width:100%!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{position:relative!important;display:grid!important;grid-template-columns:64px 1fr auto!important;align-items:center!important;gap:15px!important;width:100%!important;min-height:98px!important;padding:17px!important;border-radius:20px!important;border:1px solid var(--score-border)!important;background:radial-gradient(circle at 96% 12%,var(--score-soft),transparent 34%),radial-gradient(circle at 82% 78%,rgba(255,255,255,.08),transparent 36%),linear-gradient(145deg,rgba(255,255,255,.1),rgba(30,70,126,.26))!important;box-shadow:0 15px 32px rgba(0,10,38,.26),0 0 24px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -18px 32px rgba(0,20,60,.12)!important;color:rgba(242,252,255,.98)!important;text-align:left!important;box-sizing:border-box!important;opacity:1!important;filter:none!important;overflow:hidden!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option::before,.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option::after{content:none!important;display:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option:disabled{opacity:1!important;cursor:default!important;color:inherit!important;filter:none!important;-webkit-text-fill-color:currentColor!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--wide{grid-column:1/-1!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{display:grid!important;place-items:center!important;width:64px!important;height:64px!important;border-radius:20px!important;border:1px solid rgba(240,253,255,.74)!important;background:var(--score-badge)!important;box-shadow:0 0 28px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.5),inset 0 -12px 20px rgba(0,19,48,.18)!important;color:#fff!important;font-size:22px!important;font-weight:950!important;text-shadow:0 1px 6px rgba(0,20,45,.45)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__name{display:block!important;color:rgba(248,253,255,.99)!important;font-size:22px!important;font-weight:950!important;line-height:1.08!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__count{display:block!important;margin-top:7px!important;color:rgba(214,236,250,.94)!important;font-size:14px!important;font-weight:740!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__mark{align-self:start!important;justify-self:end!important;min-width:max-content!important;padding:6px 10px!important;border-radius:999px!important;border:1px solid rgba(206,248,255,.82)!important;background:rgba(134,232,255,.24)!important;box-shadow:0 0 14px rgba(119,225,255,.18)!important;color:rgba(238,253,255,.99)!important;font-size:11px!important;font-weight:880!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:center!important;gap:12px!important;width:100%!important;padding:16px!important;border:1px solid rgba(154,217,255,.38)!important;border-radius:20px!important;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(80,158,221,.13))!important;box-sizing:border-box!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:154px!important;min-height:48px!important;padding:12px 18px!important;border-radius:999px!important;border:1px solid rgba(175,230,255,.62)!important;background:rgba(32,65,104,.58)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)!important;color:rgba(240,252,255,.98)!important;font-size:15px!important;font-weight:850!important;white-space:nowrap!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--primary{border-color:rgba(191,243,255,.86)!important;background:linear-gradient(135deg,rgba(87,213,255,.92),rgba(168,118,255,.82))!important;box-shadow:0 0 26px rgba(102,213,255,.38),inset 0 1px 0 rgba(255,255,255,.32)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--danger{border-color:rgba(255,198,216,.86)!important;background:linear-gradient(135deg,rgba(245,105,156,.72),rgba(132,94,220,.72))!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__footer-note{text-align:center!important;padding:11px 13px!important;border:1px solid rgba(169,226,255,.28)!important;border-radius:15px!important;background:linear-gradient(90deg,transparent,rgba(98,183,240,.12),transparent)!important;color:rgba(195,227,247,.9)!important;font-size:13px!important;line-height:1.55!important;}",
            "@media (max-width:720px){.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{width:min(92vw,520px)!important;padding:20px!important;gap:13px!important;border-radius:22px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header{padding:0 34px 2px!important;align-items:flex-start!important;text-align:left!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title{font-size:28px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta,.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{grid-template-columns:1fr!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{grid-template-columns:50px 1fr auto!important;min-height:86px!important;padding:13px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{width:50px!important;height:50px!important;border-radius:16px!important;font-size:17px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{display:grid!important;grid-template-columns:1fr!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{width:100%!important;min-width:0!important;}}",
            "@media (max-width:768px){.live2d-opening-bubble,.live2d-quiz-exit-bubble,.live2d-idle-bubble{width:min(92vw,320px);max-width:calc(100vw - 24px);font-size:13px;box-sizing:border-box;}body.keyboard-open .live2d-opening-bubble,body.keyboard-open .live2d-quiz-exit-bubble,body.keyboard-open .live2d-idle-bubble{left:50%!important;right:auto!important;top:max(12px,env(safe-area-inset-top))!important;bottom:auto!important;width:min(92vw,320px)!important;max-width:calc(100vw - 24px)!important;max-height:min(54vh,320px);overflow:auto;transform:translateX(-50%)!important;}}"
        ].join("");
        document.head.appendChild(style);
    }

    function ensureScoreGuessFinalStyles() {
        if (document.getElementById("junxue-score-guess-final-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "junxue-score-guess-final-style";
        style.textContent = [
            ".live2d-quiz.is-score-guess.live2d-popup--score-guess{width:min(880px,calc(100vw - 56px))!important;max-width:calc(100vw - 56px)!important;max-height:calc(100vh - 72px)!important;overflow:visible!important;padding:18px!important;box-sizing:border-box!important;border-color:rgba(170,230,255,.18)!important;background:radial-gradient(circle at 20% 0%,rgba(123,216,255,.08),transparent 34%),radial-gradient(circle at 86% 10%,rgba(178,132,255,.07),transparent 32%),rgba(5,16,38,.18)!important;box-shadow:0 18px 54px rgba(0,10,32,.24),inset 0 1px 0 rgba(255,255,255,.06)!important;-webkit-backdrop-filter:blur(8px) saturate(1.05);backdrop-filter:blur(8px) saturate(1.05);}",
            ".live2d-quiz.is-score-guess.live2d-popup--score-guess .live2d-quiz__meta,.live2d-quiz.is-score-guess.live2d-popup--score-guess .live2d-quiz__question,.live2d-quiz.is-score-guess.live2d-popup--score-guess .live2d-quiz__result:empty{display:none!important;}",
            ".live2d-quiz.is-score-guess.live2d-popup--score-guess .score-guess-shell{width:100%!important;max-width:100%!important;display:block!important;box-sizing:border-box!important;}",
            ".score-guess-panel::before,.score-guess-panel::after,.score-guess-option::before,.score-guess-option::after{pointer-events:none;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{position:relative!important;isolation:isolate!important;display:flex!important;flex-direction:column!important;gap:14px!important;width:100%!important;max-width:820px!important;max-height:calc(100vh - 104px)!important;overflow-y:auto!important;overflow-x:hidden!important;padding:22px 24px 18px!important;border-radius:28px!important;border:1px solid rgba(164,231,255,.42)!important;background-image:url(\"assets/ui/star-dust.svg\"),radial-gradient(circle at 14% 10%,rgba(175,235,255,.3),transparent 28%),radial-gradient(circle at 86% 14%,rgba(174,134,255,.24),transparent 34%),radial-gradient(ellipse at 50% 100%,rgba(77,196,255,.18),transparent 45%),linear-gradient(145deg,rgba(10,24,50,.88),rgba(5,12,30,.94))!important;background-size:180px 120px,auto,auto,auto,auto!important;background-repeat:repeat,no-repeat,no-repeat,no-repeat,no-repeat!important;box-shadow:0 24px 72px rgba(2,10,26,.54),0 0 38px rgba(92,197,255,.18),0 0 28px rgba(176,132,255,.12),inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(100,180,255,.13),inset 0 -34px 64px rgba(65,90,185,.12)!important;-webkit-backdrop-filter:blur(22px) saturate(1.28);backdrop-filter:blur(22px) saturate(1.28);box-sizing:border-box!important;color:rgba(238,250,255,.96)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]::before{content:\"\"!important;position:absolute!important;inset:0!important;z-index:0!important;border-radius:inherit!important;background:url(\"assets/ui/frost-corner.svg\") left top/132px 132px no-repeat,url(\"assets/ui/frost-corner.svg\") right bottom/132px 132px no-repeat,linear-gradient(90deg,rgba(255,255,255,0),rgba(232,253,255,.62),rgba(160,226,255,.24),rgba(255,255,255,0)) top 0 left 34px/calc(100% - 102px) 1px no-repeat!important;opacity:.52!important;transform:translateZ(0)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]::after{content:\"\"!important;position:absolute!important;left:8%!important;right:6%!important;top:12px!important;height:190px!important;z-index:0!important;background:url(\"assets/ui/aurora-streak.svg\") center top/100% 150px no-repeat,radial-gradient(ellipse at 74% 18%,rgba(126,217,255,.12),rgba(183,139,255,.07) 42%,transparent 70%)!important;opacity:.72!important;-webkit-mask-image:linear-gradient(90deg,transparent,rgba(0,0,0,.9) 15%,rgba(0,0,0,.8) 78%,transparent),linear-gradient(180deg,rgba(0,0,0,.9),transparent 92%);mask-image:linear-gradient(90deg,transparent,rgba(0,0,0,.9) 15%,rgba(0,0,0,.8) 78%,transparent),linear-gradient(180deg,rgba(0,0,0,.9),transparent 92%);-webkit-mask-composite:source-in;pointer-events:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]>*{position:relative!important;z-index:1!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header{display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:7px!important;padding:0 42px 2px!important;border:0!important;background:transparent!important;box-shadow:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__eyebrow{padding:5px 13px!important;border-color:rgba(178,235,255,.5)!important;background:linear-gradient(90deg,rgba(88,205,255,.16),rgba(190,146,255,.1))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 14px rgba(96,211,255,.14)!important;color:rgba(207,243,255,.94)!important;font-size:12px!important;letter-spacing:0!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__title{font-size:38px!important;font-weight:940!important;letter-spacing:0!important;text-shadow:0 0 16px rgba(116,219,255,.32),0 2px 0 rgba(8,22,48,.28)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__status-pill{padding:7px 15px!important;border-color:rgba(190,237,255,.58)!important;background:linear-gradient(90deg,rgba(82,190,255,.22),rgba(181,132,255,.18))!important;box-shadow:0 0 16px rgba(102,211,255,.16),inset 0 1px 0 rgba(255,255,255,.2)!important;color:rgba(238,252,255,.96)!important;font-size:13px!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__question{font-size:18px!important;font-weight:880!important;color:rgba(242,252,255,.96)!important;text-shadow:0 0 14px rgba(110,213,255,.16)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__desc{max-width:680px!important;margin:0 auto!important;color:rgba(196,226,246,.76)!important;font-size:13px!important;line-height:1.65!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item{display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;grid-template-areas:\"icon label\" \"icon value\"!important;align-items:center!important;gap:3px 10px!important;min-width:0!important;min-height:66px!important;padding:10px 12px!important;border-radius:15px!important;border:1px solid rgba(150,220,255,.34)!important;background:radial-gradient(circle at 18% 16%,rgba(151,225,255,.12),transparent 38%),linear-gradient(145deg,rgba(255,255,255,.07),rgba(75,148,212,.09))!important;box-shadow:0 10px 22px rgba(0,13,42,.12),inset 0 1px 0 rgba(255,255,255,.16),inset 0 -12px 22px rgba(33,88,154,.08)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item:hover{border-color:rgba(184,238,255,.48)!important;box-shadow:0 0 18px rgba(94,206,255,.12),inset 0 1px 0 rgba(255,255,255,.2)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-icon{grid-area:icon!important;display:grid!important;place-items:center!important;width:36px!important;height:36px!important;border-radius:999px!important;border:1px solid rgba(200,242,255,.54)!important;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.92),rgba(112,216,255,.66) 42%,rgba(70,100,210,.58))!important;box-shadow:0 0 16px rgba(104,211,255,.24),inset 0 1px 0 rgba(255,255,255,.42),inset 0 -8px 12px rgba(0,22,55,.14)!important;color:#fff!important;font-size:15px!important;text-shadow:0 1px 5px rgba(0,18,42,.34)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-label{grid-area:label!important;display:block!important;margin:0!important;color:rgba(180,222,244,.76)!important;font-size:11px!important;font-weight:740!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-value{grid-area:value!important;display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:rgba(247,253,255,.98)!important;font-size:15px!important;font-weight:900!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;width:100%!important;background:url(\"assets/ui/aurora-streak.svg\") center 8px/88% 120px no-repeat,url(\"assets/ui/star-dust.svg\") center/180px 120px repeat!important;border-radius:22px!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{appearance: none!important;-webkit-appearance: none!important;font:inherit!important;position:relative!important;display:grid!important;grid-template-columns:50px minmax(0,1fr) auto!important;align-items:center!important;gap:12px!important;width:100%!important;min-height:78px!important;padding:12px 14px!important;border-radius:18px!important;border:1px solid var(--score-border)!important;background:radial-gradient(circle at 92% 14%,var(--score-soft),transparent 36%),radial-gradient(circle at 18% 0%,rgba(171,232,255,.11),transparent 42%),linear-gradient(145deg,rgba(18,43,82,.72),rgba(12,25,58,.68))!important;background-clip:padding-box!important;box-shadow:0 12px 26px rgba(0,10,38,.2),0 0 18px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.2),inset 0 -14px 26px rgba(0,20,60,.12)!important;color:rgba(242,252,255,.98)!important;text-align:left!important;box-sizing:border-box!important;opacity:1!important;filter:none!important;overflow:hidden!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option::before{content:\"\"!important;display:block!important;position:absolute!important;left:1px!important;right:1px!important;top:1px!important;height:48%!important;border-radius:17px 17px 10px 10px!important;background:linear-gradient(180deg,rgba(255,255,255,.14),transparent),linear-gradient(115deg,transparent 12%,rgba(255,255,255,.12) 35%,transparent 58%)!important;pointer-events:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option::after{content:\"\"!important;display:block!important;position:absolute!important;inset:0!important;background:url(\"assets/ui/star-dust.svg\") center/180px 120px repeat,radial-gradient(circle at 12% 88%,rgba(216,248,255,.1),transparent 42%)!important;opacity:.38!important;pointer-events:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option:hover:not(:disabled){transform:translateY(-1px)!important;border-color:rgba(226,250,255,.76)!important;box-shadow:0 16px 30px rgba(0,10,38,.22),0 0 26px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.28)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option:disabled{appearance: none!important;-webkit-appearance: none!important;opacity:1!important;cursor:default!important;color:inherit!important;filter:none!important;-webkit-text-fill-color:currentColor!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--wide{grid-column:1/-1!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--selected{border-color:rgba(238,253,255,.92)!important;background:radial-gradient(circle at 88% 18%,var(--score-soft),transparent 38%),linear-gradient(145deg,rgba(48,116,181,.78),rgba(52,43,120,.72))!important;box-shadow:0 0 30px var(--score-glow),0 14px 28px rgba(0,10,38,.24),inset 0 0 20px rgba(255,255,255,.14)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--bronze{--score-badge-a:#ffe3bb;--score-badge-b:#d38a4a;--score-badge-image:url(\"assets/ui/score-bronze.svg\");--score-border:rgba(226,145,89,.62);--score-glow:rgba(226,137,72,.28);--score-soft:rgba(226,137,72,.14);}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--silver{--score-badge-a:#ffffff;--score-badge-b:#d4efff;--score-badge-image:url(\"assets/ui/score-silver.svg\");--score-border:rgba(205,237,255,.64);--score-glow:rgba(205,237,255,.28);--score-soft:rgba(205,237,255,.14);}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--gold{--score-badge-a:#fff7bd;--score-badge-b:#edc148;--score-badge-image:url(\"assets/ui/score-gold.svg\");--score-border:rgba(235,197,82,.62);--score-glow:rgba(243,198,67,.28);--score-soft:rgba(243,198,67,.14);}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--top{--score-badge-a:#ffffff;--score-badge-b:#c79aff;--score-badge-image:url(\"assets/ui/score-top.svg\");--score-border:rgba(183,139,255,.62);--score-glow:rgba(169,114,255,.32);--score-soft:rgba(169,114,255,.16);}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option--none{--score-badge-a:#dce9f7;--score-badge-b:#829bbe;--score-badge-image:url(\"assets/ui/score-none.svg\");--score-border:rgba(150,179,215,.52);--score-glow:rgba(132,161,204,.22);--score-soft:rgba(132,161,204,.12);}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{position:relative!important;z-index:1!important;display:grid!important;place-items:center!important;width:50px!important;height:50px!important;border-radius:17px!important;border:1px solid rgba(240,253,255,.58)!important;background-image:var(--score-badge-image),radial-gradient(circle at 35% 24%,var(--score-badge-a),var(--score-badge-b) 56%,rgba(26,42,86,.8))!important;background-position:center!important;background-size:92% 92%,100% 100%!important;background-repeat:no-repeat!important;box-shadow:0 0 20px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.5),inset 0 -10px 16px rgba(0,19,48,.18)!important;color:rgba(255,255,255,.92)!important;font-size:15px!important;font-weight:950!important;text-shadow:0 1px 6px rgba(0,20,45,.72)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__body,.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__mark{position:relative!important;z-index:1!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{border-radius:30px 24px 30px 24px!important;border-color:rgba(178,238,255,.38)!important;background-image:url(\"assets/ui/star-dust.svg\"),radial-gradient(circle at 10% 8%,rgba(190,243,255,.32),transparent 25%),radial-gradient(ellipse at 92% 12%,rgba(185,132,255,.24),transparent 32%),radial-gradient(ellipse at 50% 104%,rgba(82,205,255,.2),transparent 46%),linear-gradient(145deg,rgba(10,24,50,.84),rgba(5,12,30,.96))!important;box-shadow:0 26px 76px rgba(2,10,26,.56),0 0 42px rgba(92,197,255,.18),0 0 34px rgba(176,132,255,.13),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(100,180,255,.13),inset 0 0 0 1px rgba(231,252,255,.055),inset 0 -36px 70px rgba(65,90,185,.13)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item{position:relative!important;overflow:hidden!important;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)!important;border-color:rgba(168,230,255,.3)!important;background:radial-gradient(circle at 16% 18%,rgba(190,244,255,.16),transparent 40%),linear-gradient(135deg,rgba(255,255,255,.08),rgba(70,150,218,.08) 52%,rgba(112,97,205,.07))!important;box-shadow:0 12px 24px rgba(0,12,40,.14),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -14px 24px rgba(26,80,150,.08)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta-item::after{content:\"\"!important;position:absolute!important;inset:1px!important;clip-path:inherit!important;background:linear-gradient(115deg,rgba(255,255,255,.16),transparent 28%,transparent 68%,rgba(146,218,255,.12))!important;opacity:.58!important;pointer-events:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{clip-path:polygon(14px 0,calc(100% - 18px) 0,100% 16px,100% calc(100% - 14px),calc(100% - 14px) 100%,18px 100%,0 calc(100% - 16px),0 14px)!important;border-color:var(--score-border)!important;background:radial-gradient(circle at 92% 13%,var(--score-soft),transparent 34%),radial-gradient(circle at 18% 0%,rgba(185,238,255,.13),transparent 38%),linear-gradient(145deg,rgba(18,45,84,.7),rgba(9,21,54,.72) 64%,rgba(31,32,79,.62))!important;box-shadow:0 13px 28px rgba(0,10,38,.22),0 0 22px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -16px 28px rgba(0,20,60,.14)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{border-radius:16px 10px 16px 10px!important;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)!important;box-shadow:0 0 22px var(--score-glow),inset 0 1px 0 rgba(255,255,255,.52),inset 0 -10px 16px rgba(0,19,48,.2),0 7px 14px rgba(0,10,34,.18)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__voters{position:relative!important;display:grid!important;gap:10px!important;padding:13px!important;border:1px solid rgba(167,228,255,.28)!important;border-radius:20px!important;clip-path:polygon(16px 0,calc(100% - 16px) 0,100% 16px,100% calc(100% - 16px),calc(100% - 16px) 100%,16px 100%,0 calc(100% - 16px),0 16px)!important;background:url(\"assets/ui/star-dust.svg\") center/190px 130px repeat,radial-gradient(circle at 12% 8%,rgba(183,238,255,.13),transparent 34%),linear-gradient(145deg,rgba(12,34,66,.58),rgba(11,23,54,.62))!important;box-shadow:0 14px 28px rgba(0,10,34,.18),inset 0 1px 0 rgba(255,255,255,.14),inset 0 -16px 26px rgba(70,98,190,.1)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__voters::before{content:\"\"!important;position:absolute!important;left:18px!important;right:18px!important;top:0!important;height:1px!important;background:linear-gradient(90deg,transparent,rgba(236,253,255,.76),rgba(164,224,255,.2),transparent)!important;pointer-events:none!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__header{display:flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;flex-wrap:wrap!important;text-align:center!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__eyebrow{padding:4px 10px!important;border:1px solid rgba(185,236,255,.4)!important;border-radius:999px!important;background:linear-gradient(90deg,rgba(87,199,255,.13),rgba(184,139,255,.1))!important;color:rgba(202,236,250,.86)!important;font-size:11px!important;font-weight:780!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__title{color:rgba(244,253,255,.96)!important;font-size:15px!important;font-weight:900!important;text-shadow:0 0 14px rgba(111,218,255,.18)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__status{text-align:center!important;color:rgba(193,226,245,.78)!important;font-size:12px!important;line-height:1.5!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:8px!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group{--voter-border:rgba(178,231,255,.3);--voter-glow:rgba(101,211,255,.12);min-width:0!important;padding:9px!important;border:1px solid var(--voter-border)!important;border-radius:14px!important;clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 9px,100% calc(100% - 9px),calc(100% - 9px) 100%,9px 100%,0 calc(100% - 9px),0 9px)!important;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(45,106,170,.08))!important;box-shadow:0 0 14px var(--voter-glow),inset 0 1px 0 rgba(255,255,255,.14)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group--bronze{--voter-border:rgba(226,145,89,.42);--voter-glow:rgba(226,137,72,.12);} .score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group--silver{--voter-border:rgba(205,237,255,.46);--voter-glow:rgba(205,237,255,.12);} .score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group--gold{--voter-border:rgba(235,197,82,.42);--voter-glow:rgba(243,198,67,.12);} .score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group--top{--voter-border:rgba(183,139,255,.44);--voter-glow:rgba(169,114,255,.14);} .score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group--none{--voter-border:rgba(150,179,215,.38);--voter-glow:rgba(132,161,204,.1);}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group-title{display:flex!important;justify-content:space-between!important;gap:6px!important;align-items:center!important;color:rgba(242,252,255,.94)!important;font-size:12px!important;font-weight:860!important;} .score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group-title em{font-style:normal!important;color:rgba(188,224,244,.78)!important;font-size:11px!important;font-weight:740!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__names{display:flex!important;flex-wrap:wrap!important;gap:5px!important;margin-top:8px!important;min-height:22px!important;} .score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__name,.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__empty{display:inline-flex!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;padding:3px 7px!important;border-radius:999px!important;border:1px solid rgba(180,232,255,.22)!important;background:rgba(12,34,66,.42)!important;color:rgba(221,241,252,.86)!important;font-size:11px!important;line-height:1.25!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__empty{color:rgba(174,209,229,.62)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{position:sticky!important;bottom:0!important;z-index:3!important;display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:center!important;gap:10px!important;width:100%!important;margin-top:2px!important;padding:12px!important;border:1px solid rgba(154,217,255,.22)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(12,34,66,.82),rgba(16,42,78,.78))!important;box-shadow:0 -12px 26px rgba(1,10,30,.18),inset 0 1px 0 rgba(255,255,255,.12)!important;-webkit-backdrop-filter:blur(12px) saturate(1.14);backdrop-filter:blur(12px) saturate(1.14);box-sizing:border-box!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px),0 14px)!important;border-color:rgba(174,229,255,.2)!important;background:linear-gradient(180deg,rgba(13,36,70,.84),rgba(13,30,62,.82))!important;box-shadow:0 -12px 26px rgba(1,10,30,.18),0 0 22px rgba(101,211,255,.08),inset 0 1px 0 rgba(255,255,255,.13)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{appearance: none!important;-webkit-appearance: none!important;font:inherit!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:134px!important;min-height:44px!important;padding:10px 15px!important;border-radius:999px!important;border:1px solid rgba(175,230,255,.46)!important;background:linear-gradient(135deg,rgba(44,101,155,.52),rgba(23,50,96,.56))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 0 14px rgba(96,204,255,.1)!important;color:rgba(240,252,255,.98)!important;font-size:14px!important;font-weight:850!important;white-space:nowrap!important;cursor:pointer!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action:hover{transform:translateY(-1px)!important;border-color:rgba(218,248,255,.68)!important;box-shadow:0 0 18px rgba(101,211,255,.2),inset 0 1px 0 rgba(255,255,255,.22)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action:active{transform:translateY(0)!important;box-shadow:inset 0 1px 8px rgba(0,14,42,.24)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action:disabled{opacity:1!important;filter:none!important;color:rgba(224,244,255,.72)!important;background:linear-gradient(135deg,rgba(42,82,126,.4),rgba(24,45,82,.46))!important;cursor:default!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--primary{border-color:rgba(191,243,255,.74)!important;background:linear-gradient(135deg,rgba(88,211,255,.82),rgba(166,118,255,.7))!important;box-shadow:0 0 24px rgba(102,213,255,.28),inset 0 1px 0 rgba(255,255,255,.28)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--danger{border-color:rgba(255,197,220,.62)!important;background:linear-gradient(135deg,rgba(232,104,154,.56),rgba(139,101,220,.58))!important;box-shadow:0 0 20px rgba(245,116,166,.18),inset 0 1px 0 rgba(255,255,255,.2)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action--soft:last-child{border-color:rgba(170,219,246,.3)!important;background:linear-gradient(135deg,rgba(31,70,116,.42),rgba(18,38,76,.46))!important;color:rgba(218,239,252,.88)!important;}",
            ".score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__footer-note{text-align:center!important;padding:9px 12px!important;border:1px solid rgba(169,226,255,.18)!important;border-radius:15px!important;background:linear-gradient(90deg,transparent,rgba(98,183,240,.08),transparent)!important;color:rgba(188,222,244,.78)!important;font-size:12px!important;line-height:1.5!important;}",
            "@media (max-width:860px){.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__group--none{grid-column:1/-1!important;}}",
            "@media (max-width:720px){.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-voters__grid{grid-template-columns:1fr!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__voters{padding:11px!important;clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px)!important;}}",
            "@media (max-width:720px){.live2d-quiz.is-score-guess.live2d-popup--score-guess{width:min(92vw,520px)!important;max-width:calc(100vw - 24px)!important;max-height:calc(100vh - 88px)!important;padding:10px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"]{width:100%!important;max-width:100%!important;max-height:calc(100vh - 108px)!important;padding:18px!important;gap:12px!important;border-radius:22px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__header{padding:0 34px 2px!important;text-align:left!important;align-items:flex-start!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__meta,.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__options{grid-template-columns:1fr!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option{grid-template-columns:46px minmax(0,1fr) auto!important;min-height:72px!important;padding:11px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-option__badge{width:46px!important;height:46px!important;border-radius:15px!important;font-size:17px!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-panel__actions{display:grid!important;grid-template-columns:1fr!important;position:sticky!important;bottom:0!important;}.score-guess-panel.score-guess-panel--final[data-score-guess-ui-version=\"20260620-score-guess-polish3\"] .score-guess-action{width:100%!important;min-width:0!important;}}"
        ].join("");
        document.head.appendChild(style);
    }

    function createOpeningBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-opening-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function createIdleBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-idle-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function createQuizExitBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-quiz-exit-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function createFortuneBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-quiz-exit-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function showOpeningBubble(bubble) {
        bubble.textContent = openingVoiceText;
        positionLive2DPopup(bubble, {
            width: 328,
            height: 96,
            offsetY: 56
        });
        bubble.classList.remove("is-fading");
        bubble.classList.add("is-open");
        window.clearTimeout(showOpeningBubble.timer);
        showOpeningBubble.timer = window.setTimeout(function () {
            hideOpeningBubble(bubble);
        }, 7000);
    }

    function hideOpeningBubble(bubble) {
        window.clearTimeout(showOpeningBubble.timer);
        bubble.classList.add("is-fading");
        bubble.classList.remove("is-open");
        window.clearTimeout(hideOpeningBubble.timer);
        hideOpeningBubble.timer = window.setTimeout(function () {
            bubble.classList.remove("is-fading");
            bubble.textContent = "";
        }, 360);
    }

    function showQuizExitBubble(bubble) {
        bubble.textContent = quizExitVoiceText;
        positionLive2DPopup(bubble, {
            width: 318,
            height: 92,
            offsetY: 62
        });
        bubble.classList.remove("is-fading");
        bubble.classList.add("is-open");
        window.clearTimeout(showQuizExitBubble.timer);
        showQuizExitBubble.timer = window.setTimeout(function () {
            hideQuizExitBubble(bubble);
        }, 5000);
    }

    function hideQuizExitBubble(bubble) {
        window.clearTimeout(showQuizExitBubble.timer);
        bubble.classList.add("is-fading");
        bubble.classList.remove("is-open");
        window.clearTimeout(hideQuizExitBubble.timer);
        hideQuizExitBubble.timer = window.setTimeout(function () {
            bubble.classList.remove("is-fading");
            bubble.textContent = "";
        }, 360);
    }

    function showFortuneBubble(bubble) {
        bubble.textContent = fortuneBubbleText;
        positionLive2DPopup(bubble, {
            width: 318,
            height: 92,
            offsetY: 62
        });
        bubble.classList.remove("is-fading");
        bubble.classList.add("is-open");
        window.clearTimeout(showFortuneBubble.timer);
        showFortuneBubble.timer = window.setTimeout(function () {
            hideFortuneBubble(bubble);
        }, 6000);
    }

    function hideFortuneBubble(bubble) {
        window.clearTimeout(showFortuneBubble.timer);
        bubble.classList.add("is-fading");
        bubble.classList.remove("is-open");
        window.clearTimeout(hideFortuneBubble.timer);
        hideFortuneBubble.timer = window.setTimeout(function () {
            bubble.classList.remove("is-fading");
            bubble.textContent = "";
        }, 360);
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

    function getLive2DRect() {
        const selectors = ["#ganyu-live2d-frame-shell>.live2d-hit-area", "#ganyu-live2d-frame-shell", "#ganyu-live2d-frame", ".ganyu-static-card", "#oml2d-stage", "#oml2d-canvas", ".live2d-hit-area"];

        for (let index = 0; index < selectors.length; index += 1) {
            const node = document.querySelector(selectors[index]);

            if (node && node.getBoundingClientRect) {
                const rect = node.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    return rect;
                }
            }
        }

        return {
            left: 10,
            top: Math.max(0, window.innerHeight - 500),
            right: 310,
            bottom: window.innerHeight - 96,
            width: 300,
            height: 390
        };
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function positionLive2DPopup(node, options) {
        if (!node) {
            return;
        }

        const settings = options || {};
        const rect = getLive2DRect();
        const gap = settings.gap || 14;
        const margin = settings.margin || 8;
        const fallbackWidth = settings.width || 330;
        const fallbackHeight = settings.height || 160;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const mobileMaxWidthRatio = typeof settings.mobileMaxWidthRatio === "number" ? settings.mobileMaxWidthRatio : 0.72;
        const mobileMaxWidth = Math.max(160, Math.floor(viewportWidth * mobileMaxWidthRatio));
        const desktopMaxWidth = Math.max(160, viewportWidth - margin * 2);
        const popupWidth = Math.min(node.offsetWidth || fallbackWidth, viewportWidth <= 768 ? mobileMaxWidth : desktopMaxWidth);
        const popupHeight = node.offsetHeight || fallbackHeight;
        const maxLeft = Math.max(margin, viewportWidth - popupWidth - margin);
        const maxTop = Math.max(margin, viewportHeight - popupHeight - margin);
        const headBottom = rect.top + rect.height * 0.35;
        const preferredRatio = typeof settings.preferredRatio === "number" ? settings.preferredRatio : 0.22;
        const preferredOffset = typeof settings.offsetY === "number" ? settings.offsetY : rect.height * preferredRatio;
        const preferredTop = clamp(rect.top + preferredOffset, margin, maxTop);
        const footTop = clamp(rect.bottom - popupHeight - gap, margin, maxTop);
        const candidates = [
            { left: rect.right + gap, top: preferredTop },
            { left: rect.left - gap - popupWidth, top: preferredTop },
            { left: clamp(rect.right - popupWidth, margin, maxLeft), top: footTop }
        ];
        let nextLeft = candidates[2].left;
        let nextTop = candidates[2].top;

        node.style.maxWidth = viewportWidth <= 768 ? (Math.round(mobileMaxWidthRatio * 100) + "vw") : "calc(100vw - " + (margin * 2) + "px)";

        function overlapsHead(left, top) {
            const right = left + popupWidth;
            const bottom = top + popupHeight;
            const overlapsX = right > rect.left && left < rect.right;
            const overlapsY = bottom > rect.top && top < headBottom;

            return overlapsX && overlapsY;
        }

        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            const fitsViewport = candidate.left >= margin &&
                candidate.left + popupWidth <= viewportWidth - margin &&
                candidate.top >= margin &&
                candidate.top + popupHeight <= viewportHeight - margin;

            if (fitsViewport && !overlapsHead(candidate.left, candidate.top)) {
                nextLeft = candidate.left;
                nextTop = candidate.top;
                break;
            }
        }

        node.style.setProperty("position", "fixed", "important");
        if (node.classList && node.classList.contains("live2d-quiz")) {
            node.style.zIndex = "63";
        }
        node.style.left = clamp(nextLeft, margin, maxLeft) + "px";
        node.style.top = clamp(nextTop, margin, maxTop) + "px";
        node.style.right = "auto";
        node.style.bottom = "auto";
    }

    function positionDefaultTips() {
        const tips = document.querySelector("#oml2d-tips");

        if (!tips) {
            return;
        }

        tips.style.setProperty("position", "fixed", "important");
        tips.style.setProperty("z-index", "62", "important");
        tips.style.setProperty("pointer-events", "none", "important");
        positionLive2DPopup(tips, {
            width: 190,
            height: 72,
            offsetY: 92,
            gap: 12
        });
    }

    function initInteractions() {
        const dialog = createDialog();
        const openingBubble = document.querySelector(".live2d-opening-bubble") || createOpeningBubble();
        const quizExitBubble = createQuizExitBubble();
        const idleBubble = createIdleBubble();
        const fortuneBubble = createFortuneBubble();
        const hitArea = document.querySelector(".live2d-hit-area") || createHitArea();
        const closeButton = dialog.querySelector(".live2d-quiz__close");
        const meta = dialog.querySelector(".live2d-quiz__meta");
        const question = dialog.querySelector(".live2d-quiz__question");
        const options = dialog.querySelector(".live2d-quiz__options");
        const result = dialog.querySelector(".live2d-quiz__result");
        const boundNodes = new WeakSet();
        const isSuggestionPage = /(^|\/)suggest\.html(?:$|[?#])/i.test(window.location.pathname + window.location.search + window.location.hash);
        let idleTalkTimer = null;
        let fortuneProcessTimer = null;
        let dialogMode = "menu";
        let popupSyncFrame = 0;
        let beautifulMenuShell = null;

        function disableBeautifulMenuShell() {
            if (!beautifulMenuShell) {
                return;
            }

            dialog.insertBefore(meta, beautifulMenuShell);
            dialog.insertBefore(question, beautifulMenuShell);
            dialog.insertBefore(options, beautifulMenuShell);
            dialog.insertBefore(result, beautifulMenuShell);
            beautifulMenuShell.remove();
            beautifulMenuShell = null;
        }

        function enableBeautifulMenuShell() {
            if (beautifulMenuShell) {
                return;
            }

            beautifulMenuShell = document.createElement("div");
            beautifulMenuShell.className = "live2d-menu-beautiful-shell live2d-menu-shell live2d-menu-shell--replica";

            const panel = document.createElement("div");
            panel.className = "live2d-menu-panel";

            const frame = document.createElement("img");
            frame.className = "live2d-menu-beautiful-frame live2d-menu-frame live2d-menu-panel__texture";
            frame.src = "assets/images/Beautiful.png";
            frame.alt = "";
            frame.draggable = false;
            frame.setAttribute("aria-hidden", "true");

            const ornament = document.createElement("div");
            ornament.className = "live2d-menu-panel__ornament";
            ornament.setAttribute("aria-hidden", "true");

            const moon = document.createElement("div");
            moon.className = "live2d-menu-panel__moon";
            moon.setAttribute("aria-hidden", "true");

            const wave = document.createElement("div");
            wave.className = "live2d-menu-beautiful-wave live2d-menu-panel__wave";
            wave.setAttribute("aria-hidden", "true");

            const content = document.createElement("div");
            content.className = "live2d-menu-beautiful-content live2d-menu-content live2d-menu-panel__content";
            content.appendChild(meta);
            content.appendChild(question);
            content.appendChild(options);
            content.appendChild(result);

            panel.appendChild(frame);
            panel.appendChild(ornament);
            panel.appendChild(moon);
            panel.appendChild(wave);
            panel.appendChild(content);
            beautifulMenuShell.appendChild(panel);
            dialog.appendChild(beautifulMenuShell);
        }

        function clearSpinTimers() {
            window.clearInterval(heroSpinTimer);
            window.clearTimeout(heroSpinTimeout);
            heroSpinTimer = null;
            heroSpinTimeout = null;
        }

        function refreshMusicPlayerContent() {
            if (dialog.classList.contains("is-music")) {
                renderMusicPlayerContent();
            }
        }

        function ensureMusicAudio() {
            if (!musicAudio) {
                musicAudio = new Audio();
                musicAudio.preload = "none";
                musicAudio.onended = function () {
                    selectMusic(currentMusicIndex + 1, true);
                };
                musicAudio.onerror = function () {
                    const failedSrc = musicAudio.currentSrc || musicAudio.getAttribute("src") || "";

                    if (failedSrc) {
                        console.warn("[JunxueMusic] Audio failed to load:", failedSrc);
                    }
                    musicPlaying = false;
                    result.textContent = "这首歌暂时播放不了，换一首试试吧～";
                    result.className = "live2d-quiz__result is-warning";
                    refreshMusicPlayerContent();
                };
            }

            return musicAudio;
        }

        function closeCurrentMusic() {
            if (!musicAudio) {
                musicPlaying = false;
                refreshMusicPlayerContent();
                return;
            }

            musicAudio.pause();
            try {
                musicAudio.currentTime = 0;
            } catch (error) {
                // Ignore browsers that block seeking before audio metadata is loaded.
            }
            musicAudio.removeAttribute("src");
            try {
                musicAudio.load();
            } catch (error) {
                // Ignore browsers that do not like loading after src cleanup.
            }
            musicPlaying = false;
            refreshMusicPlayerContent();
        }

        function getGanyuUIState() {
            return window.JunxueGanyuUIState || null;
        }

        function setDialogMode(mode) {
            dialogMode = mode === "panel" ? "panel" : "menu";
        }

        function notifyDialogOpen() {
            const state = getGanyuUIState();

            if (!state) {
                return;
            }

            if (dialogMode === "panel") {
                if (typeof state.openMenu === "function") {
                    state.openMenu();
                }

                if (typeof state.openPanel === "function") {
                    state.openPanel();
                }

                return;
            }

            if (typeof state.openMenu === "function") {
                state.openMenu();
            }

            if (typeof state.closePanel === "function") {
                state.closePanel();
            }
        }

        function notifyDialogClosed() {
            const state = getGanyuUIState();

            if (state && typeof state.closeAll === "function") {
                state.closeAll();
            }
        }

        function clearDialog() {
            if (dialog.classList.contains("is-score-guess")) {
                cleanupScoreGuessRealtime();
            }

            disableBeautifulMenuShell();
            clearSpinTimers();
            window.clearTimeout(fortuneProcessTimer);
            fortuneProcessTimer = null;
            dialog.classList.remove("is-opening", "is-wheel", "is-weather", "is-music", "is-fortune", "is-memory", "is-boss-auth", "is-boss-auth-register", "is-boss-auth-login", "is-boss-register", "is-boss-review", "is-checkin", "is-score-guess", "is-main-menu", "live2d-popup--score-guess", "live2d-menu-dialog--score-guess");
            dialog.removeAttribute("data-score-guess-ui-version");
            meta.textContent = "";
            question.textContent = "";
            options.innerHTML = "";
            result.textContent = "";
            result.className = "live2d-quiz__result";
            options.className = "live2d-quiz__options";
            options.removeAttribute("data-score-guess-ui-version");
        }

        function safeText(value, fallback) {
            return typeof value === "string" ? value : (fallback || "");
        }

        function randomBetween(min, max) {
            return Math.random() * (max - min) + min;
        }

        function getIdleDelayMultiplier() {
            const mode = window.JunxuePerformanceMode;

            return mode && typeof mode.getLive2DIdleDelayMultiplier === "function" ?
                mode.getLive2DIdleDelayMultiplier() :
                1;
        }

        function pickRandomItem(items) {
            return items[Math.floor(Math.random() * items.length)];
        }

        function replayOpenAnimation() {
            dialog.classList.remove("is-opening");
            void dialog.offsetWidth;
            dialog.classList.add("is-opening");
        }

        function getDialogPositionOptions() {
            let width = 400;
            let height = 220;
            let preferredRatio = 0.22;
            let gap = 20;
            let margin = 8;
            let mobileMaxWidthRatio = 0.72;

            if (dialog.classList.contains("is-main-menu")) {
                width = 430;
                height = 600;
                preferredRatio = 0.08;
                gap = 14;
                margin = 10;
                mobileMaxWidthRatio = 0.92;
            } else if (dialog.classList.contains("is-boss-review")) {
                width = 720;
            } else if (dialog.classList.contains("is-boss-auth")) {
                width = 840;
                height = 520;
                mobileMaxWidthRatio = 0.92;
            } else if (dialog.classList.contains("is-score-guess")) {
                width = 860;
                height = 620;
                margin = 16;
                mobileMaxWidthRatio = 0.92;
            } else if (dialog.classList.contains("is-fortune") || dialog.classList.contains("is-memory")) {
                width = 440;
            }

            return {
                width: width,
                height: height,
                preferredRatio: preferredRatio,
                gap: gap,
                margin: margin,
                mobileMaxWidthRatio: mobileMaxWidthRatio
            };
        }

        function clampScoreGuessDialogToViewport() {
            if (!dialog.classList.contains("live2d-popup--score-guess")) {
                return;
            }

            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const margin = viewportWidth <= 768 ? 12 : 18;
            const rect = dialog.getBoundingClientRect();
            const width = rect.width || dialog.offsetWidth || 320;
            const height = rect.height || dialog.offsetHeight || 240;
            const maxLeft = Math.max(margin, viewportWidth - width - margin);
            const maxTop = Math.max(margin, viewportHeight - height - margin);
            const currentLeft = Number.parseFloat(dialog.style.left || rect.left || 0);
            const currentTop = Number.parseFloat(dialog.style.top || rect.top || 0);
            const centeredLeft = Math.max(margin, Math.floor((viewportWidth - width) / 2));
            const nextLeft = viewportWidth <= 768 ? centeredLeft : clamp(currentLeft, margin, maxLeft);
            const nextTop = clamp(currentTop, margin, maxTop);

            dialog.style.left = nextLeft + "px";
            dialog.style.top = nextTop + "px";
            dialog.style.right = "auto";
            dialog.style.bottom = "auto";
        }

        function refreshDialogPosition() {
            if (!dialog.classList.contains("is-open")) {
                return;
            }

            positionLive2DPopup(dialog, getDialogPositionOptions());
            clampScoreGuessDialogToViewport();
        }

        function showDialog() {
            hideIdleTalk();
            notifyDialogOpen();
            positionLive2DPopup(dialog, getDialogPositionOptions());
            clampScoreGuessDialogToViewport();
            dialog.classList.add("is-open");
            replayOpenAnimation();
            window.clearTimeout(showDialog.closeTimer);
        }

        function removeOpeningVoiceFallback() {
            document.removeEventListener("click", handleOpeningVoiceGesture, true);
            document.removeEventListener("touchstart", handleOpeningVoiceGesture, true);
            openingVoiceRetryBound = false;
            openingVoiceRetryPending = false;
        }

        function bindOpeningVoiceFallback() {
            if (openingVoiceRetryBound) {
                return;
            }

            openingVoiceRetryBound = true;
            document.addEventListener("click", handleOpeningVoiceGesture, true);
            document.addEventListener("touchstart", handleOpeningVoiceGesture, {
                capture: true,
                passive: true
            });
        }

        function tryPlayOpeningVoice(allowRetry) {
            if (openingVoicePlaying) {
                return Promise.resolve(false);
            }

            openingVoicePlaying = true;
            return playOpeningVoice().then(function (played) {
                openingVoicePlaying = false;

                if (!played && allowRetry) {
                    openingVoiceRetryPending = true;
                    bindOpeningVoiceFallback();
                } else if (played) {
                    removeOpeningVoiceFallback();
                }

                return played;
            });
        }

        function retryOpeningVoiceFromGesture() {
            if (!openingVoiceRetryPending) {
                return;
            }

            removeOpeningVoiceFallback();
            tryPlayOpeningVoice(false);
        }

        function handleOpeningVoiceGesture() {
            retryOpeningVoiceFromGesture();
        }

        function syncLive2DPopupPositions() {
            positionDefaultTips();

            if (dialog.classList.contains("is-open")) {
                refreshDialogPosition();
            }

            if (openingBubble.textContent) {
                positionLive2DPopup(openingBubble, {
                    width: 328,
                    height: 96,
                    offsetY: 56
                });
            }

            if (quizExitBubble.textContent) {
                positionLive2DPopup(quizExitBubble, {
                    width: 318,
                    height: 92,
                    offsetY: 62
                });
            }

            if (idleBubble.textContent) {
                positionLive2DPopup(idleBubble, {
                    width: 318,
                    height: 92,
                    offsetY: 62
                });
            }

            if (fortuneBubble.textContent) {
                positionLive2DPopup(fortuneBubble, {
                    width: 318,
                    height: 92,
                    offsetY: 62
                });
            }
        }

        function scheduleLive2DPopupPositions() {
            if (popupSyncFrame) {
                return;
            }

            popupSyncFrame = window.requestAnimationFrame(function () {
                popupSyncFrame = 0;
                syncLive2DPopupPositions();
            });
        }

        function closeDialog() {
            clearSpinTimers();
            if (dialog.classList.contains("is-score-guess")) {
                cleanupScoreGuessRealtime();
            }
            dialog.classList.remove("is-open", "is-opening");
            window.clearTimeout(showDialog.closeTimer);
            notifyDialogClosed();
        }

        function hideIdleTalk() {
            window.clearTimeout(showIdleTalk.timer);
            idleBubble.classList.add("is-fading");
            idleBubble.classList.remove("is-open");
            window.clearTimeout(hideIdleTalk.timer);
            hideIdleTalk.timer = window.setTimeout(function () {
                idleBubble.classList.remove("is-fading");
                idleBubble.textContent = "";
            }, 360);
        }

        function canShowIdleTalk() {
            const state = getGanyuUIState();

            if (window.JunxueGanyuTalk && window.JunxueGanyuTalk.handlesIdle) {
                return false;
            }

            return window.enableGanyuIdleTalk !== false &&
                !(state && typeof state.isBusy === "function" && state.isBusy()) &&
                !isSuggestionPage &&
                !document.hidden &&
                !dialog.classList.contains("is-open") &&
                !openingBubble.textContent &&
                !quizExitBubble.textContent &&
                !idleBubble.textContent;
        }

        function showIdleTalk() {
            if (!canShowIdleTalk()) {
                return;
            }

            if (window.JunxueGanyuTalk && typeof window.JunxueGanyuTalk.say === "function") {
                window.JunxueGanyuTalk.say(pickRandomItem(ganyuIdleLines), "", randomBetween(4000, 6000));
                return;
            }

            window.clearTimeout(showIdleTalk.timer);
        }

        function scheduleIdleTalk(first) {
            window.clearTimeout(idleTalkTimer);

            if ((window.JunxueGanyuTalk && window.JunxueGanyuTalk.handlesIdle) || window.enableGanyuIdleTalk === false || isSuggestionPage) {
                return;
            }

            const delayMultiplier = getIdleDelayMultiplier();

            idleTalkTimer = window.setTimeout(function () {
                showIdleTalk();
                scheduleIdleTalk(false);
            }, (first ? randomBetween(8000, 12000) : randomBetween(45000, 90000)) * delayMultiplier);
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
            if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.shouldIgnoreMenuEvent === "function" && window.JunxueLive2DDrag.shouldIgnoreMenuEvent(event)) {
                return;
            }

            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            if (firstClickVoicePlaying) {
                return;
            }

            if (event) {
                retryOpeningVoiceFromGesture();
            }

            if (event && !openingVoicePlaying && !hasPlayedFirstClickVoice()) {
                firstClickVoicePlaying = true;
                markFirstClickVoicePlayed();
                clearDialog();
                setDialogMode("menu");
                question.textContent = firstClickVoiceText;
                showDialog();
                playVoice(firstClickVoicePath).then(function () {
                    firstClickVoicePlaying = false;
                    showMenu();
                });
                return;
            }

            clearDialog();
            setDialogMode("menu");
            dialog.classList.add("is-main-menu");
            const mainMenuToken = ++live2dMainMenuRenderToken;
            enableBeautifulMenuShell();
            meta.textContent = "甘雨菜单";
            question.innerHTML = [
                '<div class="live2d-menu-header">',
                    '<div class="live2d-menu-title">想和甘雨做什么？</div>',
                    '<div class="live2d-menu-user">当前登录：未登录</div>',
                '</div>'
            ].join("");
            options.classList.add("live2d-quiz__menu");
            addOption("日常娱乐", showEntertainmentPanel).setAttribute("data-menu-icon", "乐");
            addOption("直播互动", showLiveInteractionPanel).setAttribute("data-menu-icon", "播");
            addOption("咨询", showConsultPanel).setAttribute("data-menu-icon", "询");
            addOption("认识君雪", showKnowJunxuePanel).setAttribute("data-menu-icon", "雪");
            const currentAdminMenuState = getLive2DAdminMenuStateForCurrentSession();
            if (currentAdminMenuState.loaded && currentAdminMenuState.isAdmin) {
                addOption("管理员后台", function () {
                    recordGanyuFeature("管理员后台");
                    window.location.href = "admin.html";
                }).setAttribute("data-menu-icon", "管");
            } else {
                refreshMainMenuAdminEntryWhenReady(mainMenuToken);
            }
            addOption("意见箱", function () {
                recordGanyuFeature("意见箱");
                window.location.href = "suggest.html";
            }).setAttribute("data-menu-icon", "信");
            updateAccountLine(".live2d-menu-user", "当前登录：");
            showDialog();
        }

        function refreshMainMenuAdminEntryWhenReady(mainMenuToken) {
            loadLive2DAdminMenuState(true).then(function (state) {
                if (!state.isAdmin || !isCurrentMainMenuRender(mainMenuToken)) {
                    return;
                }

                showMenu();
            }).catch(function () {});
        }

        function isCurrentMainMenuRender(mainMenuToken) {
            return live2dMainMenuRenderToken === mainMenuToken &&
                dialog &&
                dialog.classList.contains("is-main-menu") &&
                meta.textContent === "甘雨菜单";
        }

        function getLive2DAdminMenuStateForCurrentSession() {
            const currentSessionKey = getCurrentSupabaseUserKey();
            if (!currentSessionKey || live2dAdminMenuState.sessionKey !== currentSessionKey) {
                return {
                    loaded: false,
                    isAdmin: false
                };
            }

            return live2dAdminMenuState;
        }

        function getCurrentSupabaseUserKey() {
            try {
                const storageKey = findSupabaseAuthStorageKey();
                const rawSession = storageKey ? window.localStorage.getItem(storageKey) : "";
                const sessionData = rawSession ? JSON.parse(rawSession) : null;
                return sessionData && sessionData.user && typeof sessionData.user.id === "string" ? sessionData.user.id : "";
            } catch (error) {
                return "";
            }
        }

        function findSupabaseAuthStorageKey() {
            if (!window.localStorage || typeof window.localStorage.length !== "number") {
                return "";
            }

            try {
                const supabaseUrl = getSupabaseConfigValue("SUPABASE_URL");
                const hostname = supabaseUrl ? new URL(supabaseUrl).hostname : "";
                const projectRef = hostname ? hostname.split(".")[0] : "";
                const configuredKey = projectRef ? "sb-" + projectRef + "-auth-token" : "";
                if (configuredKey) {
                    return configuredKey;
                }
            } catch (error) {}

            for (let index = 0; index < window.localStorage.length; index += 1) {
                const key = window.localStorage.key(index);
                if (key && /^sb-.+-auth-token$/.test(key)) {
                    return key;
                }
            }

            return "";
        }

        function showEntertainmentPanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "日常娱乐";
            question.textContent = "今天想和甘雨轻松一下吗？";
            options.classList.add("live2d-consult-grid");
            addConsultCard("无奖竞答", "题目挑战", false, startQuiz);
            addConsultCard("查看天气", "天气查询", false, showWeatherInput);
            addConsultCard("占卜", "今日运势", false, showFortunePanel);
            addConsultCard("听歌", "甘雨歌单", false, showMusicPlayer);
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "选一个日常小功能吧。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showLiveInteractionPanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "直播互动";
            question.textContent = "直播时可以一起玩的内容都放在这里。";
            options.classList.add("live2d-consult-grid");
            addConsultCard("英雄池转盘", "今天玩谁？", false, showHeroWheel);
            addConsultCard("评分竞猜", "猜猜这局评分", false, showScoreGuessPanel);
            addConsultCard("直播惩罚", "敬请期待", false, function () {
                recordGanyuFeature("直播惩罚");
                result.textContent = "直播惩罚玩法还在设计中，先欠着你一局～";
                result.className = "live2d-quiz__result is-neutral";
            });
            addConsultCard("更多互动", "敬请期待", false, function () {
                recordGanyuFeature("更多互动");
                result.textContent = "更多直播互动还在慢慢准备中，之后会补上～";
                result.className = "live2d-quiz__result is-neutral";
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "直播互动入口先放在这里啦。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showKnowJunxuePanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "认识君雪";
            question.textContent = "这些事情，甘雨都替君雪记着呢。";
            options.classList.add("live2d-consult-grid");
            addConsultCard("认识一下", "关于君雪", false, function () {
                recordGanyuFeature("认识一下");
                closeDialog();
                const memory = getGanyuMemory();

                if (memory && typeof memory.showNamePrompt === "function") {
                    memory.showNamePrompt();
                }
            });
            addConsultCard("甘雨记得你", "看看甘雨记住的小事", false, function () {
                showMemoryPanel();
            });
            addConsultCard("星湖签到", "每日签到领积分", false, function () {
                recordGanyuFeature("星湖签到");
                showBossDailyCheckinPanel();
            });
            addConsultCard("联系君雪", "想咨询陪玩、复盘或互动合作，可以从这里找到我。", false, function () {
                recordGanyuFeature("联系君雪");
                showJunxueContactPanel();
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "想先聊哪一件事呢？";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showJunxueContactPanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "认识君雪";
            question.innerHTML = [
                '<strong class="live2d-panel-title">联系君雪</strong>',
                '<span class="live2d-panel-copy">想咨询陪玩、复盘或互动合作，可以从这里找到我。</span>'
            ].join("");
            options.classList.add("live2d-consult-grid");
            addConsultCard("查看联系方式", "联系方式需按页面提示付款后手动查看，请不要重复支付。", false, function () {
                recordGanyuFeature("查看联系方式");
                window.location.href = "contact.html";
            });
            addConsultCard("返回", "回到认识君雪", false, function () {
                showKnowJunxuePanel();
            });
            result.textContent = "联系方式需按页面提示付款后手动查看，请不要重复支付。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function getSupabaseConfigValue(name) {
            return typeof window[name] === "string" ? window[name].trim() : "";
        }

        function hasBossRegisterConfig() {
            const url = getSupabaseConfigValue("SUPABASE_URL");
            const key = getSupabaseConfigValue("SUPABASE_ANON_KEY");

            return /^https:\/\/.+\.supabase\.co$/i.test(url) &&
                !!key &&
                key.indexOf("你的 Supabase") === -1 &&
                (key.indexOf("sb_publishable_") === 0 || key.indexOf("eyJ") === 0);
        }

        function loadExternalScript(src) {
            return new Promise(function (resolve, reject) {
                const scriptPath = getScriptPath(src);
                const existing = Array.prototype.find.call(document.scripts, function (script) {
                    return getScriptPath(script.getAttribute("src")) === scriptPath;
                });

                if (existing) {
                    if (existing.dataset && existing.dataset.junxueLoading === "true") {
                        existing.addEventListener("load", resolve, { once: true });
                        existing.addEventListener("error", function () {
                            reject(new Error("script-load-failed: " + src));
                        }, { once: true });
                        return;
                    }

                    resolve();
                    return;
                }

                const script = document.createElement("script");

                script.src = src;
                script.async = true;
                script.dataset.junxueLoading = "true";
                script.onload = function () {
                    script.dataset.junxueLoading = "false";
                    script.dataset.junxueLoaded = "true";
                    resolve();
                };
                script.onerror = function () {
                    script.dataset.junxueLoading = "false";
                    script.remove();
                    reject(new Error("script-load-failed: " + src));
                };
                document.head.appendChild(script);
            });
        }

        function getScriptPath(src) {
            const value = String(src || "");
            const cleanValue = value.split("#")[0].split("?")[0];

            if (!cleanValue) {
                return "";
            }

            try {
                return new URL(cleanValue, window.location.href).pathname;
            } catch (error) {
                return cleanValue;
            }
        }

        async function loadSupabaseSdk() {
            if (window.supabase && typeof window.supabase.createClient === "function") {
                return;
            }

            try {
                await loadExternalScript(SUPABASE_LOCAL_SDK);
            } catch (localError) {
                console.warn("[JunxueBossReviews] local Supabase SDK load failed, falling back to jsdelivr.", localError);
                try {
                    await loadExternalScript(SUPABASE_CDN);
                } catch (cdnError) {
                    console.error("[JunxueBossReviews] Supabase SDK load failed.", cdnError);
                    throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
                }
            }

            if (!window.supabase || typeof window.supabase.createClient !== "function") {
                throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
            }
        }

        async function getSharedSupabaseClient() {
            try {
                if (!window.JunxueSupabaseClient || typeof window.JunxueSupabaseClient.getClient !== "function") {
                    await loadExternalScript("assets/supabase-client.js?v=20260626-boss-admin1").catch(function () {});
                }

                if (window.JunxueSupabaseClient && typeof window.JunxueSupabaseClient.getClient === "function") {
                    return await window.JunxueSupabaseClient.getClient();
                }
            } catch (error) {
                console.warn("[JunxueLive2D] shared Supabase client unavailable, falling back.", error);
            }

            return null;
        }

        function isBlockedInteractionError(error) {
            const message = error && error.message ? String(error.message) : "";
            return message === BLOCKED_INTERACTION_TEXT ||
                /account.*blocked|blocked.*account|账号.*暂时不能参与互动|row-level security|violates row-level security|policy/i.test(message);
        }

        async function ensureBossAccountNotBlocked(activeClient) {
            if (!activeClient || typeof activeClient.rpc !== "function") {
                return { isBlocked: false };
            }

            const response = await activeClient.rpc("get_own_boss_account_flags", {});

            if (response.error) {
                if (/get_own_boss_account_flags|schema cache|function .* does not exist/i.test(response.error.message || "")) {
                    return { isBlocked: false };
                }
                throw response.error;
            }

            const row = Array.isArray(response.data) ? response.data[0] : response.data;

            if (row && (row.is_blocked || row.isBlocked)) {
                throw new Error(BLOCKED_INTERACTION_TEXT);
            }

            return { isBlocked: false };
        }

        async function ensureBossRegisterClient() {
            await loadExternalScript("assets/supabase-config.js?v=20260611-1").catch(function () {});

            if (!hasBossRegisterConfig()) {
                throw new Error("老板账号注册暂未配置，请稍后再试。");
            }

            const sharedClient = await getSharedSupabaseClient();

            if (sharedClient) {
                return sharedClient;
            }

            await loadSupabaseSdk();
            return window.supabase.createClient(
                getSupabaseConfigValue("SUPABASE_URL"),
                getSupabaseConfigValue("SUPABASE_ANON_KEY")
            );
        }

        function openBossRegisterPage() {
            window.location.href = "boss-register.html";
        }

        function showBossRegisterPanel() {
            openBossRegisterPage();
            return;

            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-boss-auth", "is-boss-register", "is-boss-auth-register");
            meta.textContent = "老板账号";
            question.textContent = "这是您在本站参与互动、评价和投票使用的专属账号，不会覆盖甘雨本地记忆中的昵称。";
            options.innerHTML = [
                '<div class="live2d-boss-auth-shell">',
                    '<div class="live2d-boss-auth-ambient" aria-hidden="true">',
                        '<div>',
                            '<span class="live2d-boss-auth-kicker">冰湖访客凭证</span>',
                            '<div class="live2d-boss-auth-title">欢迎来到君雪的小小互动星湖</div>',
                            '<p class="live2d-boss-auth-copy">注册后可参与投票、发布评价，并使用更多专属互动功能。甘雨会记得本地昵称，账号只用于登录与同步互动记录。</p>',
                        '</div>',
                        '<ul class="live2d-boss-auth-notes">',
                            '<li>专属账号用于本站互动，不会覆盖本地记忆昵称。</li>',
                            '<li>邮箱只用于登录与 Supabase Auth 验证。</li>',
                            '<li>注册后可回到登录入口继续参与评价与投票。</li>',
                        '</ul>',
                    '</div>',
                    '<form class="live2d-boss-auth-card live2d-boss-register-form">',
                        '<div class="live2d-boss-auth-heading">',
                            '<span class="live2d-boss-auth-heading__eyebrow">Boss Account</span>',
                            '<strong class="live2d-boss-auth-heading__title">注册老板账号</strong>',
                            '<span class="live2d-boss-auth-heading__desc">填写邮箱和密码后，就可以在本站留下评价、参与投票与更多互动。</span>',
                        '</div>',
                        '<div class="live2d-boss-auth-fields">',
                            '<label class="live2d-boss-auth-field" data-icon="✦">',
                                '<span class="live2d-boss-auth-label">邮箱</span>',
                                '<input class="live2d-weather-input live2d-boss-auth-input" name="email" type="email" autocomplete="email" placeholder="用于登录的邮箱">',
                            '</label>',
                            '<label class="live2d-boss-auth-field" data-icon="◇">',
                                '<span class="live2d-boss-auth-label">密码</span>',
                                '<input class="live2d-weather-input live2d-boss-auth-input" name="password" type="password" autocomplete="new-password" placeholder="设置登录密码">',
                            '</label>',
                            '<label class="live2d-boss-auth-field" data-icon="✧">',
                                '<span class="live2d-boss-auth-label">确认密码</span>',
                                '<input class="live2d-weather-input live2d-boss-auth-input" name="confirmPassword" type="password" autocomplete="new-password" placeholder="再输入一次密码">',
                            '</label>',
                        '</div>',
                        '<div class="live2d-boss-auth-actions">',
                            '<button class="live2d-boss-auth-action live2d-boss-auth-primary" type="submit">注册老板账号</button>',
                            '<button class="live2d-boss-auth-action live2d-boss-auth-secondary" type="button" data-action="login">返回登录</button>',
                            '<button class="live2d-boss-auth-action live2d-boss-auth-ghost" type="button" data-action="back">返回菜单</button>',
                        '</div>',
                        '<p class="live2d-boss-auth-hint">注册后可参与互动、发布评价，并使用更多专属功能。</p>',
                    '</form>',
                '</div>'
            ].join("");
            result.textContent = "账号仅用于本站互动与评价，不会影响甘雨本地记住的称呼。";
            result.className = "live2d-quiz__result live2d-boss-auth-note is-neutral";
            showDialog();

            const form = options.querySelector(".live2d-boss-register-form");
            const submitButton = form.querySelector('button[type="submit"]');
            const loginButton = form.querySelector('[data-action="login"]');
            const backButton = form.querySelector('[data-action="back"]');

            loginButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showBossReviewAuthPanel("login");
            });

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showConsultPanel();
            });

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const email = form.elements.email.value.trim();
                const password = form.elements.password.value;
                const confirmPassword = form.elements.confirmPassword.value;

                if (!email || !password || !confirmPassword) {
                    result.textContent = "请先把邮箱、密码和确认密码都填好哦。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                if (password !== confirmPassword) {
                    result.textContent = "两次密码不一致，请再检查一下。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                submitButton.disabled = true;
                result.textContent = "正在为你点亮老板账号……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const client = await ensureBossRegisterClient();
                    const response = await client.auth.signUp({ email: email, password: password });

                    if (response.error) {
                        result.textContent = response.error.message + " 这个邮箱可能已经注册过了，可以返回登录试试。";
                        result.className = "live2d-quiz__result is-warning";
                        return;
                    }

                    form.reset();
                    result.textContent = response.data && response.data.session ?
                        "注册成功啦～现在可以返回登录，继续参与评价、投票和互动。" :
                        "注册成功，请先去邮箱确认账号，再回来登录。";
                    result.className = "live2d-quiz__result is-good";
                } catch (error) {
                    result.textContent = error.message || "老板账号注册暂时不可用，请稍后再试。";
                    result.className = "live2d-quiz__result is-warning";
                } finally {
                    submitButton.disabled = false;
                }
            });
        }


        async function ensureBossReviewsApi() {
            try {
                await loadExternalScript("assets/supabase-client.js?v=20260626-boss-admin1").catch(function () {});
                await loadExternalScript("assets/supabase-config.js?v=20260611-1").catch(function () {});
                await loadExternalScript("assets/price-reviews.js?v=20260626-boss-nickname-bind1");
            } catch (error) {
                console.warn("[JunxueBossProfile] boss profile script load failed.", error);
                throw new Error(BOSS_PROFILE_SCRIPT_LOAD_ERROR_TEXT);
            }

            if (!window.JunxueBossReviews) {
                throw new Error("老板资料脚本已加载，但初始化暂时失败，请刷新页面后再试。");
            }

            return window.JunxueBossReviews;
        }

        function normalizeBossDisplayNameInput(value) {
            return String(value || "").trim();
        }

        async function showBossProfilePanel(message) {
            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-weather", "is-boss-auth", "is-boss-auth-login");
            meta.textContent = "老板资料";
            question.textContent = "可以在这里查看并修改老板昵称。这个昵称会用于老板评价和评分竞猜管理员投票名单。";
            options.innerHTML = '<div class="live2d-quiz__loading">正在读取老板资料……</div>';
            result.textContent = safeText(message, "老板昵称只用于本站互动展示，不会覆盖甘雨本地记忆里的称呼。");
            result.className = "live2d-quiz__result is-neutral";
            showDialog();

            let api = null;
            let session = null;

            try {
                api = await ensureBossReviewsApi();
                session = await api.getSession();
            } catch (error) {
                options.innerHTML = '<div class="live2d-quiz__loading">老板资料暂时不可用。</div>';
                result.textContent = error.message || "老板资料暂时不可用，请稍后再试。";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (!session || !session.user) {
                options.innerHTML = [
                    '<div class="boss-modal-panel">',
                        '<div class="boss-form-heading"><span class="boss-form-badge">Boss Profile</span><span>请先登录老板账号</span></div>',
                        '<p class="live2d-boss-auth-hint">登录后可以查看当前老板昵称，也可以随时修改。</p>',
                        '<div class="boss-modal-actions">',
                            '<button class="live2d-quiz__option boss-modal-primary" type="button" data-action="login">登录老板账号</button>',
                            '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                        '</div>',
                    '</div>'
                ].join("");
                result.textContent = "老板昵称需要登录后才能管理。";
                result.className = "live2d-quiz__result is-warning";
                refreshDialogPosition();
                options.querySelector('[data-action="login"]').addEventListener("click", function (event) {
                    event.stopPropagation();
                    showBossReviewAuthPanel("login");
                });
                options.querySelector('[data-action="back"]').addEventListener("click", function (event) {
                    event.stopPropagation();
                    showConsultPanel();
                });
                return;
            }

            let profile = { displayName: "", warning: "" };

            if (typeof api.loadBossProfile === "function") {
                try {
                    profile = await api.loadBossProfile();
                } catch (error) {
                    profile.warning = error.message || "老板昵称暂时读取失败，请稍后再试。";
                }
            }

            const currentName = normalizeBossDisplayNameInput(profile.displayName) || "老板昵称";
            const safeWarning = profile.warning ? '<p class="live2d-boss-auth-hint is-warning">' + escapeHtml(profile.warning) + '</p>' : '';

            options.innerHTML = [
                '<form class="boss-modal-panel live2d-boss-profile-form">',
                    '<div class="boss-form-heading"><span class="boss-form-badge">Boss Profile</span><span>老板昵称管理</span></div>',
                    '<div class="boss-form-grid">',
                        '<div class="boss-info-strip">当前老板昵称：<strong data-boss-profile-current>' + escapeHtml(currentName) + '</strong></div>',
                        '<label class="live2d-boss-auth-field" data-icon="✧">',
                            '<span class="live2d-boss-auth-label">修改老板昵称</span>',
                            '<input class="live2d-weather-input boss-form-control" name="displayName" maxlength="20" autocomplete="nickname" value="' + escapeHtml(currentName) + '" placeholder="请输入 1-20 字昵称">',
                        '</label>',
                    '</div>',
                    safeWarning,
                    '<div class="boss-modal-actions">',
                        '<button class="live2d-quiz__option boss-modal-primary" type="submit">保存昵称</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                    '</div>',
                '</form>'
            ].join("");
            result.textContent = profile.warning || "老板昵称会用于老板评价和评分竞猜投票名单。";
            result.className = "live2d-quiz__result " + (profile.warning ? "is-warning" : "is-neutral");
            refreshDialogPosition();

            const form = options.querySelector(".live2d-boss-profile-form");
            const submitButton = form.querySelector('button[type="submit"]');
            const backButton = form.querySelector('[data-action="back"]');
            const currentNode = form.querySelector("[data-boss-profile-current]");

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showConsultPanel();
            });

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const nextName = normalizeBossDisplayNameInput(form.elements.displayName.value);

                if (!nextName) {
                    result.textContent = "老板昵称不能为空哦";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                if (nextName.length > 20) {
                    result.textContent = "老板昵称最多 20 个字";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                if (!api || typeof api.updateBossDisplayName !== "function") {
                    result.textContent = "老板昵称功能还需要执行数据库升级 SQL。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                submitButton.disabled = true;
                result.textContent = "正在保存老板昵称……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const response = await api.updateBossDisplayName(nextName);

                    if (currentNode) {
                        currentNode.textContent = response.displayName || nextName;
                    }
                    form.elements.displayName.value = response.displayName || nextName;
                    result.textContent = response.warning || "老板昵称已保存。之后评价和投票名单都会优先使用这个昵称。";
                    result.className = "live2d-quiz__result " + (response.warning ? "is-warning" : "is-good");
                    if (typeof api.refreshReviewWall === "function") {
                        api.refreshReviewWall().catch(function () {});
                    }
                } catch (error) {
                    result.textContent = error.message || "老板昵称暂时保存失败，请稍后再试。";
                    result.className = "live2d-quiz__result is-warning";
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        function isCheckinSetupError(error) {
            const message = error && error.message ? String(error.message) : "";
            const code = error && error.code ? String(error.code) : "";

            return code === "42P01" ||
                code === "42883" ||
                code === "PGRST202" ||
                /claim_boss_daily_checkin|get_boss_checkin_status|boss_points|boss_daily_checkins|schema cache|function .* does not exist|relation .* does not exist/i.test(message);
        }

        function isCheckinDuplicateError(error) {
            const message = error && error.message ? String(error.message) : "";
            const code = error && error.code ? String(error.code) : "";

            return code === "23505" || /duplicate key|unique constraint|boss_daily_checkins_user_id_sign_date/i.test(message);
        }

        function normalizeCheckinNumber(value) {
            const number = Number(value);
            return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
        }

        function normalizeCheckinRow(data) {
            const row = Array.isArray(data) ? (data[0] || {}) : (data || {});
            const signedDates = Array.isArray(row.signed_dates) ? row.signed_dates : [];

            return {
                signedToday: !!row.signed_today,
                alreadySigned: !!row.already_signed,
                signDate: row.sign_date || row.today_date || "",
                todayDate: row.today_date || row.sign_date || "",
                monthStart: row.month_start || "",
                rewardPoints: normalizeCheckinNumber(row.reward_points),
                totalPoints: normalizeCheckinNumber(row.total_points),
                totalCheckins: normalizeCheckinNumber(row.total_checkins),
                currentStreak: normalizeCheckinNumber(row.current_streak),
                monthlyCheckins: normalizeCheckinNumber(row.monthly_checkins),
                signedDates: signedDates.map(function (date) {
                    return String(date || "").slice(0, 10);
                }).filter(Boolean),
                message: String(row.message || "")
            };
        }

        function getCheckinMonthParts(monthStart, todayDate) {
            const source = String(monthStart || todayDate || "").slice(0, 10);
            const match = source.match(/^(\d{4})-(\d{2})-\d{2}$/);
            const fallback = new Date();

            if (!match) {
                return {
                    year: fallback.getFullYear(),
                    month: fallback.getMonth() + 1
                };
            }

            return {
                year: Number(match[1]),
                month: Number(match[2])
            };
        }

        function getCheckinMonthLabel(monthStart, todayDate) {
            const parts = getCheckinMonthParts(monthStart, todayDate);
            return String(parts.year) + " 年 " + String(parts.month).padStart(2, "0") + " 月";
        }

        function getCheckinRewardMessage(row) {
            if (!row || row.alreadySigned) {
                return CHECKIN_ALREADY_SIGNED_TEXT;
            }

            if (row.monthlyCheckins === 30 && row.rewardPoints === 50) {
                return "本月累计签到 30 天达成，今日获得 50 积分。";
            }

            if (row.currentStreak === 7 && row.rewardPoints === 20) {
                return "连续签到 7 天达成，今日获得 20 积分。";
            }

            return "签到成功，今日获得 " + String(row.rewardPoints || 10) + " 积分。";
        }

        function renderCheckinCalendar(status) {
            const parts = getCheckinMonthParts(status.monthStart, status.todayDate);
            const daysInMonth = new Date(parts.year, parts.month, 0).getDate();
            const firstDay = new Date(parts.year, parts.month - 1, 1).getDay();
            const signedMap = status.signedDates.reduce(function (map, date) {
                map[date] = true;
                return map;
            }, {});
            const today = String(status.todayDate || "").slice(0, 10);
            const cells = [];
            let index = 0;

            for (index = 0; index < firstDay; index += 1) {
                cells.push('<span class="live2d-checkin-day is-empty" aria-hidden="true"></span>');
            }

            for (index = 1; index <= daysInMonth; index += 1) {
                const dateText = String(parts.year) + "-" + String(parts.month).padStart(2, "0") + "-" + String(index).padStart(2, "0");
                const isSigned = !!signedMap[dateText];
                const isToday = dateText === today;
                const className = "live2d-checkin-day" + (isSigned ? " is-signed" : "") + (isToday ? " is-today" : "");
                const label = isSigned ? "已签到" : (isToday ? "今天" : "未签到");

                cells.push('<span class="' + className + '" aria-label="' + escapeHtml(dateText + " " + label) + '"><span class="live2d-checkin-day__num">' + String(index) + '</span><span class="live2d-checkin-day__mark" aria-hidden="true"></span></span>');
            }

            return [
                '<section class="live2d-checkin-calendar live2d-checkin-calendar-card" aria-label="本月签到日历" style="display:grid;gap:10px;width:100%;max-width:360px;justify-self:end;box-sizing:border-box;">',
                    '<div class="live2d-checkin-calendar__head">',
                        '<span>' + escapeHtml(getCheckinMonthLabel(status.monthStart, status.todayDate)) + '</span>',
                        '<span class="live2d-checkin-calendar__status">' + (status.signedToday ? "今日已完成签到" : "今日还未签到") + '</span>',
                    '</div>',
                    '<div class="live2d-checkin-weekdays" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>',
                    '<div class="live2d-checkin-days live2d-checkin-calendar-grid" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;width:100%;">',
                        cells.join(""),
                    '</div>',
                '</section>'
            ].join("");
        }

        function renderCheckinLoginPanel() {
            options.innerHTML = [
                '<div class="boss-modal-panel live2d-checkin-panel">',
                    '<div class="boss-form-heading"><span class="boss-form-badge">Star Lake</span><span>登录后签到</span></div>',
                    '<p class="live2d-boss-auth-hint">登录老板账号后就可以签到领积分啦。</p>',
                    '<div class="boss-modal-actions">',
                        '<button class="live2d-quiz__option boss-modal-primary" type="button" data-action="login">去登录</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="register">注册老板账号</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                    '</div>',
                '</div>'
            ].join("");
            result.textContent = "登录老板账号后就可以签到领积分啦。";
            result.className = "live2d-quiz__result is-warning";
            refreshDialogPosition();

            options.querySelector('[data-action="login"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showBossReviewAuthPanel("login");
            });
            options.querySelector('[data-action="register"]').addEventListener("click", function (event) {
                event.stopPropagation();
                openBossRegisterPage();
            });
            options.querySelector('[data-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showKnowJunxuePanel();
            });
        }

        async function loadBossDailyCheckinStatus(client) {
            const response = await client.rpc("get_boss_checkin_status", { p_month: null });

            if (response.error) {
                throw response.error;
            }

            return normalizeCheckinRow(response.data);
        }

        async function claimBossDailyCheckin(client) {
            await ensureBossAccountNotBlocked(client);
            const response = await client.rpc("claim_boss_daily_checkin", {});

            if (response.error) {
                throw response.error;
            }

            return normalizeCheckinRow(response.data);
        }

        function renderCheckinStatusPanel(client, displayName, status, message, type) {
            const safeName = normalizeBossDisplayNameInput(displayName) || "老板";
            const claimDisabled = status.signedToday ? " disabled" : "";
            const panelMessage = message || (status.signedToday ? "今日已完成签到。" : "今日还可以签到。");

            options.innerHTML = [
                '<div class="live2d-checkin-panel live2d-checkin-shell" data-checkin-ui-version="20260625-live2d-checkin-calendar2">',
                    '<div class="live2d-checkin-main live2d-checkin-layout" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,360px);gap:18px;align-items:start;width:100%;box-sizing:border-box;">',
                        '<div class="live2d-checkin-left live2d-checkin-info" style="display:grid;gap:12px;min-width:0;">',
                            '<section class="live2d-checkin-hero">',
                                '<span class="live2d-checkin-kicker">Star Lake Check-in</span>',
                                '<h3 class="live2d-checkin-title">星湖签到</h3>',
                                '<p class="live2d-checkin-copy">今天也欢迎你，' + escapeHtml(safeName) + '。每天来见甘雨一次，积一点温柔的小积分。</p>',
                            '</section>',
                            '<div class="live2d-checkin-stats">',
                                '<div class="live2d-checkin-stat"><span>当前积分</span><strong>' + String(status.totalPoints) + '</strong></div>',
                                '<div class="live2d-checkin-stat"><span>当前连续签到</span><strong>' + String(status.currentStreak) + ' 天</strong></div>',
                                '<div class="live2d-checkin-stat"><span>本月累计签到</span><strong>' + String(status.monthlyCheckins) + ' 天</strong></div>',
                            '</div>',
                            '<ul class="live2d-checkin-rules">',
                                '<li>普通签到：10 积分</li>',
                                '<li>连续签到第 7 天：20 积分</li>',
                                '<li>每月累计签到第 30 天：50 积分</li>',
                            '</ul>',
                            '<div class="live2d-checkin-actions">',
                                '<button class="live2d-checkin-action live2d-checkin-action--primary" type="button" data-action="claim"' + claimDisabled + '>' + (status.signedToday ? "今日已签到" : "立即签到") + '</button>',
                                '<button class="live2d-checkin-action" type="button" data-action="refresh">刷新状态</button>',
                                '<button class="live2d-checkin-action" type="button" data-action="back">返回</button>',
                            '</div>',
                            '<div class="live2d-checkin-message">' + escapeHtml(panelMessage) + '</div>',
                        '</div>',
                        renderCheckinCalendar(status),
                    '</div>',
                '</div>'
            ].join("");

            result.textContent = "";
            result.className = "live2d-quiz__result " + (type || "is-neutral");
            refreshDialogPosition();

            const claimButton = options.querySelector('[data-action="claim"]');
            const refreshButton = options.querySelector('[data-action="refresh"]');
            const backButton = options.querySelector('[data-action="back"]');

            if (claimButton) {
                claimButton.addEventListener("click", async function (event) {
                    event.stopPropagation();

                    if (claimButton.disabled) {
                        result.textContent = CHECKIN_ALREADY_SIGNED_TEXT;
                        result.className = "live2d-quiz__result is-warning";
                        return;
                    }

                    claimButton.disabled = true;
                    result.textContent = "正在把今天的星光记进签到册……";
                    result.className = "live2d-quiz__result is-neutral";

                    try {
                        const claimResult = await claimBossDailyCheckin(client);
                        const nextStatus = await loadBossDailyCheckinStatus(client);
                        const nextMessage = claimResult.alreadySigned ? CHECKIN_ALREADY_SIGNED_TEXT : getCheckinRewardMessage(claimResult);
                        renderCheckinStatusPanel(client, safeName, nextStatus, nextMessage, claimResult.alreadySigned ? "is-warning" : "is-good");
                    } catch (error) {
                        if (isCheckinDuplicateError(error)) {
                            try {
                                const nextStatus = await loadBossDailyCheckinStatus(client);
                                renderCheckinStatusPanel(client, safeName, nextStatus, CHECKIN_ALREADY_SIGNED_TEXT, "is-warning");
                                return;
                            } catch (loadError) {}
                        }

                        result.textContent = isBlockedInteractionError(error) ? BLOCKED_INTERACTION_TEXT : (isCheckinSetupError(error) ? CHECKIN_SETUP_ERROR_TEXT : CHECKIN_NETWORK_ERROR_TEXT);
                        result.className = "live2d-quiz__result is-warning";
                        claimButton.disabled = false;
                    }
                });
            }

            refreshButton.addEventListener("click", async function (event) {
                event.stopPropagation();
                refreshButton.disabled = true;
                result.textContent = "正在刷新星湖签到状态……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const nextStatus = await loadBossDailyCheckinStatus(client);
                    renderCheckinStatusPanel(client, safeName, nextStatus, "签到状态已刷新。", "is-good");
                } catch (error) {
                    result.textContent = isBlockedInteractionError(error) ? BLOCKED_INTERACTION_TEXT : (isCheckinSetupError(error) ? CHECKIN_SETUP_ERROR_TEXT : CHECKIN_NETWORK_ERROR_TEXT);
                    result.className = "live2d-quiz__result is-warning";
                    refreshButton.disabled = false;
                }
            });

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showKnowJunxuePanel();
            });
        }

        async function showBossDailyCheckinPanel() {
            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-weather", "is-boss-auth", "is-checkin");
            meta.textContent = "星湖签到";
            question.textContent = "每天来见甘雨一次，积一点温柔的小积分。";
            options.innerHTML = '<div class="live2d-quiz__loading">正在连接星湖签到册……</div>';
            result.textContent = "";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();

            let client = null;
            let session = null;

            try {
                client = await ensureScoreGuessClient();
                const sessionResponse = await client.auth.getSession();
                session = sessionResponse.data && sessionResponse.data.session ? sessionResponse.data.session : null;
            } catch (error) {
                result.textContent = CHECKIN_NETWORK_ERROR_TEXT;
                result.className = "live2d-quiz__result is-warning";
                options.innerHTML = '<div class="live2d-quiz__loading">签到暂时不可用。</div>';
                return;
            }

            if (!session || !session.user) {
                renderCheckinLoginPanel();
                return;
            }

            let displayName = getDisplayNameFromAuthUser(session.user) || "老板";

            try {
                const api = await ensureBossReviewsApi();
                if (api && typeof api.loadBossProfile === "function") {
                    const profile = await api.loadBossProfile();
                    displayName = normalizeBossDisplayNameInput(profile.displayName) || displayName;
                }
            } catch (error) {}

            try {
                const status = await loadBossDailyCheckinStatus(client);
                renderCheckinStatusPanel(client, displayName, status, status.signedToday ? "今日已完成签到。" : "今日还可以签到。", "is-neutral");
            } catch (error) {
                options.innerHTML = [
                    '<div class="boss-modal-panel live2d-checkin-panel">',
                        '<div class="boss-form-heading"><span class="boss-form-badge">Star Lake</span><span>签到暂时不可用</span></div>',
                        '<p class="live2d-boss-auth-hint">' + escapeHtml(isCheckinSetupError(error) ? CHECKIN_SETUP_ERROR_TEXT : CHECKIN_NETWORK_ERROR_TEXT) + '</p>',
                        '<div class="boss-modal-actions">',
                            '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                        '</div>',
                    '</div>'
                ].join("");
                result.textContent = isCheckinSetupError(error) ? CHECKIN_SETUP_ERROR_TEXT : CHECKIN_NETWORK_ERROR_TEXT;
                result.className = "live2d-quiz__result is-warning";
                refreshDialogPosition();
                options.querySelector('[data-action="back"]').addEventListener("click", function (event) {
                    event.stopPropagation();
                    showKnowJunxuePanel();
                });
            }
        }

        async function ensureScoreGuessClient() {
            await loadExternalScript("assets/supabase-config.js?v=20260611-1").catch(function () {});

            if (!hasBossRegisterConfig()) {
                throw new Error("评分竞猜暂时还没有配置好，请稍后再试。");
            }

            const sharedClient = await getSharedSupabaseClient();

            if (sharedClient) {
                return sharedClient;
            }

            await loadSupabaseSdk();
            return window.supabase.createClient(
                getSupabaseConfigValue("SUPABASE_URL"),
                getSupabaseConfigValue("SUPABASE_ANON_KEY")
            );
        }

        async function getCurrentAuthDisplayName() {
            try {
                const client = await ensureScoreGuessClient();
                const response = await client.auth.getSession();

                if (response.error || !response.data || !response.data.session) {
                    return "未登录";
                }

                return getDisplayNameFromAuthUser(response.data.session.user);
            } catch (error) {
                return "未登录";
            }
        }

        function updateAccountLine(selector, prefix) {
            const line = dialog.querySelector(selector);

            if (!line) {
                return;
            }

            getCurrentAuthDisplayName().then(function (name) {
                if (dialog.contains(line)) {
                    line.textContent = prefix + name;
                }
            });
        }

        function getScoreGuessChoiceTone(choice) {
            return ({
                "铜牌": "bronze",
                "银牌": "silver",
                "金牌": "gold",
                "顶级": "top",
                "无": "none"
            })[choice] || "none";
        }

        function createEmptyScoreGuessCounts() {
            return SCORE_GUESS_CHOICES.reduce(function (counts, choice) {
                counts[choice] = 0;
                return counts;
            }, {});
        }

        function getScoreGuessCounts(votes) {
            const counts = createEmptyScoreGuessCounts();

            (votes || []).forEach(function (vote) {
                if (Object.prototype.hasOwnProperty.call(counts, vote.choice)) {
                    counts[vote.choice] += 1;
                }
            });

            return counts;
        }

        function getScoreGuessUserChoice(votes, userId) {
            if (!userId) {
                return "";
            }

            const vote = (votes || []).find(function (item) {
                return item.user_id === userId;
            });

            return vote ? vote.choice : "";
        }

        function createEmptyScoreGuessVoterGroups() {
            return SCORE_GUESS_CHOICES.reduce(function (groups, choice) {
                groups[choice] = [];
                return groups;
            }, {});
        }

        function getSafeScoreGuessVoterName(value) {
            const text = String(value || "").trim();

            if (!text || /@/.test(text) || /^用户后四位\s+[0-9a-f]{4}$/i.test(text) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text)) {
                return "匿名老板";
            }

            return text.length > 18 ? text.slice(0, 18) + "..." : text;
        }

        function groupScoreGuessVoters(rows) {
            const groups = createEmptyScoreGuessVoterGroups();

            (rows || []).forEach(function (row) {
                if (!row || !Object.prototype.hasOwnProperty.call(groups, row.choice)) {
                    return;
                }

                groups[row.choice].push({
                    name: getSafeScoreGuessVoterName(row.voter_name),
                    createdAt: row.created_at || ""
                });
            });

            return groups;
        }

        async function loadScoreGuessVoters(client, sessionId, isAdmin) {
            if (!client || !sessionId || !isAdmin || typeof client.rpc !== "function") {
                return {
                    votersByChoice: createEmptyScoreGuessVoterGroups(),
                    votersLoadStatus: ""
                };
            }

            try {
                const response = await client.rpc("get_live_score_guess_voters", { p_session_id: sessionId });

                if (response.error) {
                    throw response.error;
                }

                return {
                    votersByChoice: groupScoreGuessVoters(response.data || []),
                    votersLoadStatus: "仅管理员可见。名单只显示老板昵称，不展示邮箱和完整用户 ID。"
                };
            } catch (error) {
                console.warn("[JunxueScoreGuess] voter list failed.", error);
                return {
                    votersByChoice: createEmptyScoreGuessVoterGroups(),
                    votersLoadStatus: "管理员投票名单功能还需要执行数据库升级 SQL。"
                };
            }
        }

        async function getScoreGuessAuthSession(client) {
            const response = await client.auth.getSession();

            if (response.error) {
                throw response.error;
            }

            return response.data ? response.data.session : null;
        }

        async function loadActiveScoreGuessSession(client) {
            let response = await client
                .from("live_score_guess_sessions")
                .select("*")
                .eq("status", "open")
                .order("created_at", { ascending: false })
                .limit(1);

            if (response.error) {
                throw response.error;
            }

            if (response.data && response.data.length) {
                return response.data[0];
            }

            response = await client
                .from("live_score_guess_sessions")
                .select("*")
                .eq("status", "closed")
                .order("created_at", { ascending: false })
                .limit(1);

            if (response.error) {
                throw response.error;
            }

            return response.data && response.data.length ? response.data[0] : null;
        }

        async function loadScoreGuessVotes(client, sessionId) {
            if (!sessionId) {
                return [];
            }

            const response = await client
                .from("live_score_guess_votes")
                .select("session_id,user_id,choice,updated_at")
                .eq("session_id", sessionId);

            if (response.error) {
                throw response.error;
            }

            return response.data || [];
        }

        async function checkScoreGuessAdmin(client, userId) {
            if (!userId) {
                return false;
            }

            const response = await client
                .from("live_interaction_admins")
                .select("user_id")
                .eq("user_id", userId)
                .maybeSingle();

            if (response.error) {
                console.debug("[JunxueLive2D] admin check unavailable.");
                return false;
            }

            return !!response.data;
        }

        function loadLive2DAdminMenuState(force) {
            if (live2dAdminMenuState.loaded && !force) {
                return Promise.resolve(live2dAdminMenuState);
            }

            if (live2dAdminMenuState.loadingPromise) {
                return live2dAdminMenuState.loadingPromise;
            }

            live2dAdminMenuState.loadingPromise = (async function () {
                let isAdmin = false;
                let sessionKey = "";

                try {
                    const client = await ensureScoreGuessClient();
                    const sessionResponse = await client.auth.getSession();
                    const session = sessionResponse.data && sessionResponse.data.session ? sessionResponse.data.session : null;
                    sessionKey = session && session.user && session.user.id ? session.user.id : "";
                    isAdmin = await checkScoreGuessAdmin(client, sessionKey);
                } catch (error) {
                    console.debug("[JunxueLive2D] admin menu check unavailable.");
                    isAdmin = false;
                }

                live2dAdminMenuState = {
                    loaded: true,
                    isAdmin: isAdmin,
                    sessionKey: sessionKey,
                    loadingPromise: null
                };

                return live2dAdminMenuState;
            })();

            return live2dAdminMenuState.loadingPromise;
        }

        async function loadScoreGuessData() {
            const client = await ensureScoreGuessClient();
            const authSession = await getScoreGuessAuthSession(client);
            const session = await loadActiveScoreGuessSession(client);
            const votes = await loadScoreGuessVotes(client, session && session.id);
            const isAdmin = await checkScoreGuessAdmin(client, authSession && authSession.user && authSession.user.id);
            const voterState = await loadScoreGuessVoters(client, session && session.status === "closed" ? session.id : "", isAdmin);

            scoreGuessState = {
                client: client,
                session: session,
                authSession: authSession,
                votes: votes,
                isAdmin: isAdmin,
                votersByChoice: voterState.votersByChoice,
                votersLoadStatus: voterState.votersLoadStatus,
                realtimeWarning: scoreGuessState.realtimeWarning
            };

            return scoreGuessState;
        }

        function cleanupScoreGuessRealtime() {
            if (!scoreGuessRealtimeChannels.length) {
                return;
            }

            scoreGuessRealtimeChannels.forEach(function (channel) {
                if (scoreGuessState.client && typeof scoreGuessState.client.removeChannel === "function") {
                    scoreGuessState.client.removeChannel(channel);
                }
            });
            scoreGuessRealtimeChannels = [];
        }

        function handleScoreGuessRealtimeProblem() {
            if (scoreGuessRealtimeWarningShown) {
                return;
            }

            scoreGuessRealtimeWarningShown = true;
            scoreGuessState.realtimeWarning = true;

            if (dialog.classList.contains("is-score-guess")) {
                result.textContent = "实时同步暂时不可用，数据会在操作后刷新。";
                result.className = "live2d-quiz__result is-warning";
            }
        }

        function subscribeScoreGuessRealtime(client) {
            if (!client || typeof client.channel !== "function" || scoreGuessRealtimeChannels.length) {
                return;
            }

            const refresh = function () {
                if (dialog.classList.contains("is-score-guess")) {
                    refreshScoreGuessPanel();
                }
            };
            const statusHandler = function (status) {
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                    handleScoreGuessRealtimeProblem();
                }
            };
            const sessionChannel = client
                .channel("junxue-live-score-guess-sessions")
                .on("postgres_changes", { event: "*", schema: "public", table: "live_score_guess_sessions" }, refresh)
                .subscribe(statusHandler);
            const voteChannel = client
                .channel("junxue-live-score-guess-votes")
                .on("postgres_changes", { event: "*", schema: "public", table: "live_score_guess_votes" }, refresh)
                .subscribe(statusHandler);

            scoreGuessRealtimeChannels = [sessionChannel, voteChannel];
        }

        function getScoreGuessActionMessage(error, fallback) {
            const message = error && error.message ? error.message : "";

            if (/permission|policy|rls|denied|not allowed|violates/i.test(message)) {
                return "只有君雪可以开启或结束竞猜哦～";
            }

            return fallback || SCORE_GUESS_LOAD_ERROR_TEXT;
        }

        function renderScoreGuessVoters(state, isClosed) {
            if (!state.isAdmin || !isClosed) {
                return "";
            }

            const votersByChoice = state.votersByChoice || createEmptyScoreGuessVoterGroups();
            const votersLoadStatus = state.votersLoadStatus || "仅管理员可见。";

            return [
                '<div class="score-guess-panel__voters" aria-label="管理员投票名单">',
                    '<div class="score-guess-voters__header">',
                        '<span class="score-guess-voters__eyebrow">管理员可见</span>',
                        '<strong class="score-guess-voters__title">投票名单</strong>',
                    '</div>',
                    '<div class="score-guess-voters__status">' + escapeHtml(votersLoadStatus) + '</div>',
                    '<div class="score-guess-voters__grid">',
                        SCORE_GUESS_CHOICES.map(function (choice) {
                            const voters = votersByChoice[choice] || [];
                            return [
                                '<section class="score-guess-voters__group score-guess-voters__group--' + getScoreGuessChoiceTone(choice) + '">',
                                    '<div class="score-guess-voters__group-title">',
                                        '<span>' + escapeHtml(choice) + '</span>',
                                        '<em>' + voters.length + ' 人</em>',
                                    '</div>',
                                    '<div class="score-guess-voters__names">',
                                        voters.length ? voters.map(function (voter) {
                                            return '<span class="score-guess-voters__name">' + escapeHtml(voter.name) + '</span>';
                                        }).join("") : '<span class="score-guess-voters__empty">暂无</span>',
                                    '</div>',
                                '</section>'
                            ].join("");
                        }).join(""),
                    '</div>',
                '</div>'
            ].join("");
        }

        function renderScoreGuessResults(state, message, type) {
            ensureScoreGuessFinalStyles();

            const activeSession = state.session || null;
            const currentUserId = state.authSession && state.authSession.user ? state.authSession.user.id : "";
            const userChoice = getScoreGuessUserChoice(state.votes, currentUserId);
            const counts = getScoreGuessCounts(state.votes);
            const isOpen = activeSession && activeSession.status === "open";
            const isClosed = activeSession && activeSession.status === "closed";
            const canVote = !!(isOpen && currentUserId);
            const statusLabel = activeSession ? (isOpen ? "竞猜进行中" : "竞猜已结束") : "暂未开启";
            const statusText = activeSession ? (isOpen ? "进行中" : "已结束") : "暂未开启";
            const accountLabel = getDisplayNameFromAuthUser(state.authSession && state.authSession.user);
            const choiceLabel = userChoice ? userChoice : "你还没有选择";
            const footerNote = message || (!activeSession ?
                (state.isAdmin ? "当前没有开启中的竞猜，可以开启一场新的评分竞猜。" : "当前没有开启中的竞猜。") :
                (!currentUserId ? "登录后才能参与评分竞猜哦～" :
                    (isClosed ? "竞猜已结束，看看大家猜得怎么样吧～" :
                        (userChoice ? "你当前选择了：" + userChoice + "。竞猜结束前还可以改选。" : "选择你觉得最可能的结果，竞猜结束前都可以改选。"))));

            meta.textContent = "直播互动";
            question.innerHTML = "";

            options.className = "score-guess-shell";
            dialog.setAttribute("data-score-guess-ui-version", "20260620-score-guess-polish3");
            options.setAttribute("data-score-guess-ui-version", "20260620-score-guess-polish3");
            options.innerHTML = [
                '<div class="score-guess-panel score-guess-panel--final" data-score-guess-ui-version="20260620-score-guess-polish3">',
                '<div class="score-guess-panel__header">',
                    '<div class="score-guess-panel__heading">',
                        '<div class="score-guess-panel__eyebrow">直播互动</div>',
                        '<div class="score-guess-panel__title-row">',
                            '<h3 class="score-guess-panel__title">评分竞猜</h3>',
                            '<span class="score-guess-panel__status-pill">' + escapeHtml(statusLabel) + '</span>',
                        '</div>',
                        '<div class="score-guess-panel__question">猜猜这局最后会是什么评分？</div>',
                        '<div class="score-guess-panel__desc">投票结果会同步给所有观众；竞猜结束后只展示结果，不能再修改选择。</div>',
                    '</div>',
                '</div>',
                '<div class="score-guess-panel__meta">',
                    '<div class="score-guess-panel__meta-item">',
                        '<span class="score-guess-panel__meta-icon">●</span>',
                        '<span>',
                            '<span class="score-guess-panel__meta-label">当前账号</span>',
                            '<strong class="score-guess-panel__meta-value">' + escapeHtml(accountLabel) + '</strong>',
                        '</span>',
                    '</div>',
                    '<div class="score-guess-panel__meta-item">',
                        '<span class="score-guess-panel__meta-icon">⏱</span>',
                        '<span>',
                            '<span class="score-guess-panel__meta-label">当前状态</span>',
                            '<strong class="score-guess-panel__meta-value">' + escapeHtml(statusText) + '</strong>',
                        '</span>',
                    '</div>',
                    '<div class="score-guess-panel__meta-item">',
                        '<span class="score-guess-panel__meta-icon">?</span>',
                        '<span>',
                            '<span class="score-guess-panel__meta-label">你的选择</span>',
                            '<strong class="score-guess-panel__meta-value">' + escapeHtml(choiceLabel) + '</strong>',
                        '</span>',
                    '</div>',
                '</div>',
                '<div class="score-guess-panel__options">'
            ].join("") + SCORE_GUESS_CHOICES.map(function (choice) {
                const selected = userChoice === choice;
                const tone = getScoreGuessChoiceTone(choice);
                const badge = choice.charAt(0);
                return [
                    '<button class="score-guess-option score-guess-option--' + tone + (choice === "无" ? ' score-guess-option--wide' : '') + (selected ? ' is-selected score-guess-option--selected' : '') + '" type="button" data-score-choice="' + escapeHtml(choice) + '"' + (canVote ? "" : " disabled") + '>',
                        '<span class="score-guess-option__badge">' + escapeHtml(choice === "无" ? "—" : badge) + '</span>',
                        '<span class="score-guess-option__body">',
                            '<strong class="score-guess-option__name">' + escapeHtml(choice) + '</strong>',
                            '<span class="score-guess-option__count">' + counts[choice] + ' 人选择</span>',
                        '</span>',
                        selected ? '<span class="score-guess-option__mark">已选择</span>' : '<span class="score-guess-option__mark" aria-hidden="true"></span>',
                    '</button>'
                ].join("");
            }).join("") + '</div>' + renderScoreGuessVoters(state, isClosed);

            options.innerHTML += [
                '<div class="score-guess-panel__actions">',
                    !currentUserId ? '<button class="score-guess-action score-guess-action--primary" type="button" data-score-action="login">登录 / 注册老板账号</button>' : '',
                    state.isAdmin && !isOpen ? '<button class="score-guess-action score-guess-action--primary" type="button" data-score-action="start">开启评分竞猜</button>' : '',
                    state.isAdmin && isOpen ? '<button class="score-guess-action score-guess-action--danger" type="button" data-score-action="end">结束竞猜</button>' : '',
                    '<button class="score-guess-action score-guess-action--soft" type="button" data-score-action="refresh">刷新结果</button>',
                    '<button class="score-guess-action score-guess-action--soft" type="button" data-score-action="back">返回直播互动</button>',
                '</div>',
                '<div class="score-guess-panel__footer-note">',
                    '<span>' + escapeHtml(footerNote) + '</span>',
                '</div>',
                '</div>'
            ].join("");

            if (message) {
                result.textContent = "";
                result.className = "live2d-quiz__result " + (type || "is-neutral");
            } else if (!activeSession) {
                result.textContent = "";
                result.className = "live2d-quiz__result is-neutral";
            } else if (!currentUserId) {
                result.textContent = "";
                result.className = "live2d-quiz__result is-warning";
            } else if (isClosed) {
                result.textContent = "";
                result.className = "live2d-quiz__result is-neutral";
            } else if (userChoice) {
                result.textContent = "";
                result.className = "live2d-quiz__result is-good";
            } else {
                result.textContent = "";
                result.className = "live2d-quiz__result is-neutral";
            }

            Array.prototype.forEach.call(options.querySelectorAll("[data-score-choice]"), function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    submitScoreGuessVote(button.getAttribute("data-score-choice"));
                });
            });

            Array.prototype.forEach.call(options.querySelectorAll("[data-score-action]"), function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    const action = button.getAttribute("data-score-action");

                    if (action === "login") {
                        showBossReviewAuthPanel("login", { returnTo: "scoreGuess" });
                    } else if (action === "start") {
                        startScoreGuessSession();
                    } else if (action === "end") {
                        endScoreGuessSession();
                    } else if (action === "refresh") {
                        refreshScoreGuessPanel("评分竞猜结果刷新好了。", "is-good");
                    } else if (action === "back") {
                        showLiveInteractionPanel();
                    }
                });
            });

            const scoreGuessStyle = document.getElementById("junxue-score-guess-final-style");
            const scoreGuessOptions = document.querySelector(".score-guess-panel__options");
            const firstScoreGuessOption = document.querySelector(".score-guess-option");
            const scoreGuessActions = document.querySelector(".score-guess-panel__actions");
            const actionsText = scoreGuessActions ? scoreGuessActions.textContent.replace(/\s+/g, " ").trim() : "";
            console.info("[score-guess-ui]", {
                version: "20260620-score-guess-polish3",
                hasPanel: !!document.querySelector('.score-guess-panel[data-score-guess-ui-version="20260620-score-guess-polish3"]'),
                hasStyleTag: !!scoreGuessStyle,
                styleLength: scoreGuessStyle && scoreGuessStyle.textContent ? scoreGuessStyle.textContent.length : 0,
                hasOptions: !!scoreGuessOptions,
                optionsDisplay: scoreGuessOptions ? getComputedStyle(scoreGuessOptions).display : null,
                firstOptionDisplay: firstScoreGuessOption ? getComputedStyle(firstScoreGuessOption).display : null,
                firstOptionBg: firstScoreGuessOption ? getComputedStyle(firstScoreGuessOption).backgroundImage : null,
                actionsDisplay: scoreGuessActions ? getComputedStyle(scoreGuessActions).display : null,
                actionsText: actionsText,
                hasStartButton: !!document.querySelector('[data-score-action="start"]'),
                hasEndButton: !!document.querySelector('[data-score-action="end"]'),
                hasRefreshButton: !!document.querySelector('[data-score-action="refresh"]'),
                hasBackButton: !!document.querySelector('[data-score-action="back"]'),
                hasOldConsultCard: !!document.querySelector(".score-guess-panel .live2d-consult-card"),
                hasOldWeatherActions: !!document.querySelector(".score-guess-panel .live2d-weather-actions")
            });

            refreshDialogPosition();
        }

        async function refreshScoreGuessPanel(message, type) {
            if (!dialog.classList.contains("is-score-guess")) {
                return;
            }

            try {
                const state = await loadScoreGuessData();
                renderScoreGuessResults(state, message, type);
                subscribeScoreGuessRealtime(state.client);
            } catch (error) {
                console.error("[JunxueScoreGuess] load failed.", error);
                question.innerHTML = "";
                options.className = "score-guess-shell";
                dialog.setAttribute("data-score-guess-ui-version", "20260620-score-guess-polish3");
                options.setAttribute("data-score-guess-ui-version", "20260620-score-guess-polish3");
                options.innerHTML = [
                    '<div class="score-guess-panel score-guess-panel--final" data-score-guess-ui-version="20260620-score-guess-polish3">',
                    '<div class="score-guess-panel__header">',
                        '<div class="score-guess-panel__heading">',
                            '<div class="score-guess-panel__eyebrow">直播互动</div>',
                            '<div class="score-guess-panel__title-row">',
                                '<h3 class="score-guess-panel__title">评分竞猜</h3>',
                                '<span class="score-guess-panel__status-pill">加载失败</span>',
                            '</div>',
                            '<div class="score-guess-panel__question">猜猜这局最后会是什么评分？</div>',
                            '<div class="score-guess-panel__desc">投票结果会同步给所有观众；竞猜结束后只展示结果，不能再修改选择。</div>',
                        '</div>',
                    '</div>',
                    '<div class="score-guess-panel__actions">',
                        '<button class="score-guess-action score-guess-action--primary" type="button" data-score-action="retry">再试一次</button>',
                        '<button class="score-guess-action score-guess-action--soft" type="button" data-score-action="back">返回直播互动</button>',
                    '</div>',
                    '<div class="score-guess-panel__footer-note">',
                        '<span>评分竞猜暂时加载失败，可能是网络不稳定，请稍后再试。</span>',
                    '</div>',
                    '</div>'
                ].join("");
                result.textContent = "";
                result.className = "live2d-quiz__result is-warning";
                Array.prototype.forEach.call(options.querySelectorAll("[data-score-action]"), function (button) {
                    button.addEventListener("click", function (event) {
                        event.stopPropagation();
                        if (button.getAttribute("data-score-action") === "retry") {
                            refreshScoreGuessPanel();
                        } else {
                            showLiveInteractionPanel();
                        }
                    });
                });
            }
        }

        function showScoreGuessPanel() {
            ensureScoreGuessFinalStyles();

            setDialogMode("panel");
            recordGanyuFeature("评分竞猜");
            clearDialog();
            dialog.classList.add("is-score-guess");
            dialog.classList.add("live2d-popup--score-guess");
            dialog.classList.add("live2d-menu-dialog--score-guess");
            meta.textContent = "评分竞猜";
            question.innerHTML = "";
            options.className = "score-guess-shell";
            dialog.setAttribute("data-score-guess-ui-version", "20260620-score-guess-polish3");
            options.setAttribute("data-score-guess-ui-version", "20260620-score-guess-polish3");
            options.innerHTML = [
                '<div class="score-guess-panel score-guess-panel--final" data-score-guess-ui-version="20260620-score-guess-polish3">',
                '<div class="score-guess-panel__header">',
                    '<div class="score-guess-panel__heading">',
                        '<div class="score-guess-panel__eyebrow">直播互动</div>',
                        '<div class="score-guess-panel__title-row">',
                            '<h3 class="score-guess-panel__title">评分竞猜</h3>',
                            '<span class="score-guess-panel__status-pill">正在读取</span>',
                        '</div>',
                        '<div class="score-guess-panel__question">猜猜这局最后会是什么评分？</div>',
                        '<div class="score-guess-panel__desc">投票结果会同步给所有观众；竞猜结束后只展示结果，不能再修改选择。</div>',
                    '</div>',
                '</div>',
                '<div class="live2d-quiz__loading">正在读取评分竞猜…</div>',
                '<div class="score-guess-panel__footer-note">',
                    '<span>正在同步直播互动数据，请稍等一下。</span>',
                '</div>',
                '</div>'
            ].join("");
            result.textContent = "";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
            refreshScoreGuessPanel();
        }

        async function startScoreGuessSession() {
            if (!scoreGuessState.authSession || !scoreGuessState.authSession.user || !scoreGuessState.isAdmin) {
                result.textContent = "只有君雪可以开启或结束竞猜哦～";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            try {
                const response = await scoreGuessState.client
                    .from("live_score_guess_sessions")
                    .insert({
                        title: "评分竞猜",
                        status: "open",
                        created_by: scoreGuessState.authSession.user.id
                    })
                    .select()
                    .single();

                if (response.error) {
                    throw response.error;
                }

                await refreshScoreGuessPanel("评分竞猜已经开启啦。", "is-good");
            } catch (error) {
                console.error("[JunxueScoreGuess] start failed.", error);
                result.textContent = getScoreGuessActionMessage(error, "评分竞猜暂时没能开启，请稍后再试。");
                result.className = "live2d-quiz__result is-warning";
            }
        }

        async function endScoreGuessSession() {
            if (!scoreGuessState.authSession || !scoreGuessState.authSession.user || !scoreGuessState.isAdmin) {
                result.textContent = "只有君雪可以开启或结束竞猜哦～";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (!scoreGuessState.session || scoreGuessState.session.status !== "open") {
                result.textContent = "当前没有开启中的竞猜。";
                result.className = "live2d-quiz__result is-neutral";
                return;
            }

            try {
                const response = await scoreGuessState.client
                    .from("live_score_guess_sessions")
                    .update({ status: "closed", ended_at: new Date().toISOString() })
                    .eq("id", scoreGuessState.session.id)
                    .eq("status", "open");

                if (response.error) {
                    throw response.error;
                }

                await refreshScoreGuessPanel("竞猜已结束，看看大家猜得怎么样吧～", "is-good");
            } catch (error) {
                console.error("[JunxueScoreGuess] end failed.", error);
                result.textContent = getScoreGuessActionMessage(error, "竞猜暂时没能结束，请稍后再试。");
                result.className = "live2d-quiz__result is-warning";
            }
        }

        async function submitScoreGuessVote(choice) {
            if (!scoreGuessState.authSession || !scoreGuessState.authSession.user) {
                result.textContent = "登录后才能参与竞猜。";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (!scoreGuessState.session || scoreGuessState.session.status !== "open") {
                result.textContent = "竞猜已经结束，不能再修改选择啦～";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (SCORE_GUESS_CHOICES.indexOf(choice) === -1) {
                return;
            }

            try {
                await ensureBossAccountNotBlocked(scoreGuessState.client);

                const response = await scoreGuessState.client
                    .from("live_score_guess_votes")
                    .upsert({
                        session_id: scoreGuessState.session.id,
                        user_id: scoreGuessState.authSession.user.id,
                        choice: choice,
                        updated_at: new Date().toISOString()
                    }, { onConflict: "session_id,user_id" });

                if (response.error) {
                    throw response.error;
                }

                await refreshScoreGuessPanel("你选择了：" + choice + "。", "is-good");
            } catch (error) {
                console.error("[JunxueScoreGuess] vote failed.", error);
                const message = isBlockedInteractionError(error) ? BLOCKED_INTERACTION_TEXT : (/closed|status/i.test(error.message || "") ?
                    "竞猜已经结束，不能再修改选择啦～" :
                    "评分竞猜暂时加载失败，可能是网络不稳定，请稍后再试。");
                result.textContent = message;
                result.className = "live2d-quiz__result is-warning";
            }
        }

        function isPricePage() {
            return /(^|\/)price\.html$/i.test(window.location.pathname) || window.location.pathname === "/price.html";
        }

        function scrollToBossReviewWall() {
            const wall = document.getElementById("boss-reviews");

            if (wall && typeof wall.scrollIntoView === "function") {
                wall.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        function getBossReviewEmail(session) {
            return session && session.user && session.user.email ? session.user.email : "老板";
        }

        function showBossReviewsPanel(message, type) {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "老板评价";
            question.textContent = "想看看老板们留下的话，还是也写一句给君雪呢？";
            options.classList.add("live2d-consult-grid");
            addConsultCard("查看老板评价", "评价墙与互动", false, function () {
                recordGanyuFeature("老板评价");

                if (isPricePage()) {
                    closeDialog();
                    scrollToBossReviewWall();
                    return;
                }

                window.location.href = "price.html#boss-reviews";
            });
            addConsultCard("登录/注册", "老板账号", false, function () {
                recordGanyuFeature("老板评价登录");
                showBossReviewAuthPanel("login");
            });
            addConsultCard("发布评价", "写给君雪", false, function () {
                recordGanyuFeature("发布老板评价");
                showBossReviewSubmitPanel();
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            const safeMessage = safeText(message, "老板评价会展示在收费咨询页的评价墙里。");
            const safeType = safeText(type, "is-neutral");
            result.textContent = safeMessage;
            result.className = "live2d-quiz__result " + safeType;
            showDialog();
        }

        function showBossReviewAuthPanel(mode, authOptions) {
            const returnToScoreGuess = authOptions && authOptions.returnTo === "scoreGuess";
            const prefillEmail = authOptions && typeof authOptions.prefillEmail === "string" ? authOptions.prefillEmail : "";

            if (mode === "register") {
                openBossRegisterPage();
                return;
            }

            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-weather", "is-boss-auth", mode === "register" ? "is-boss-auth-register" : "is-boss-auth-login");
            meta.textContent = mode === "register" ? "老板账号注册" : "老板账号登录";
            question.textContent = mode === "register" ?
                "这是您在本站参与互动、评价和投票使用的专属账号，不会覆盖甘雨本地记忆中的昵称。" :
                "登录后可以继续参与投票、发布评价，也能使用更多专属互动。";
            options.innerHTML = [
                '<div class="live2d-boss-auth-shell">',
                    '<div class="live2d-boss-auth-ambient" aria-hidden="true">',
                        '<div>',
                            '<span class="live2d-boss-auth-kicker">' + (mode === "register" ? "冰湖访客凭证" : "星湖通行记录") + '</span>',
                            '<div class="live2d-boss-auth-title">' + (mode === "register" ? "把这份专属互动身份交给甘雨保管" : "欢迎回来，继续和君雪互动") + '</div>',
                            '<p class="live2d-boss-auth-copy">' + (mode === "register" ? "注册后可参与投票、发布评价，并使用更多专属互动功能。账号只用于本站登录，不会覆盖本地记忆中的昵称。" : "登录后可以继续查看互动记录、参与评分竞猜，也可以在评价墙留下想说的话。") + '</p>',
                        '</div>',
                        '<ul class="live2d-boss-auth-notes">',
                            '<li>账号用于互动、评价与投票，不影响本地昵称记忆。</li>',
                            '<li>界面信息会同步到 Supabase Auth，前端不保存密码。</li>',
                            '<li>' + (mode === "register" ? "如果已经注册过，可以直接返回登录。" : "还没有账号时，可以前往独立注册页。") + '</li>',
                        '</ul>',
                    '</div>',
                    '<form class="live2d-boss-auth-card live2d-boss-auth-form">',
                        '<div class="live2d-boss-auth-heading">',
                            '<span class="live2d-boss-auth-heading__eyebrow">Boss Account</span>',
                            '<strong class="live2d-boss-auth-heading__title">' + (mode === "register" ? "注册老板账号" : "登录老板账号") + '</strong>',
                            '<span class="live2d-boss-auth-heading__desc">' + (mode === "register" ? "填写邮箱和密码后，就可以参与本站互动、评价与投票。" : "使用注册邮箱登录，回到你在本站的互动身份。") + '</span>',
                        '</div>',
                        '<div class="live2d-boss-auth-fields">',
                            '<label class="live2d-boss-auth-field" data-icon="✦">',
                                '<span class="live2d-boss-auth-label">邮箱</span>',
                                '<input class="live2d-weather-input live2d-boss-auth-input" name="email" type="email" autocomplete="email" value="' + escapeHtml(prefillEmail) + '" placeholder="用于登录的邮箱">',
                            '</label>',
                            '<label class="live2d-boss-auth-field" data-icon="◇">',
                                '<span class="live2d-boss-auth-label">密码</span>',
                                '<input class="live2d-weather-input live2d-boss-auth-input" name="password" type="password" autocomplete="' + (mode === "register" ? "new-password" : "current-password") + '" placeholder="' + (mode === "register" ? "设置登录密码" : "输入登录密码") + '">',
                            '</label>',
                            mode === "register" ? '<label class="live2d-boss-auth-field" data-icon="✧"><span class="live2d-boss-auth-label">确认密码</span><input class="live2d-weather-input live2d-boss-auth-input" name="confirmPassword" type="password" autocomplete="new-password" placeholder="再输入一次密码"></label>' : '',
                        '</div>',
                        '<div class="live2d-boss-auth-actions">',
                            '<button class="live2d-boss-auth-action live2d-boss-auth-primary" type="submit">' + (mode === "register" ? "注册老板账号" : "登录老板账号") + '</button>',
                            '<button class="live2d-boss-auth-action live2d-boss-auth-secondary" type="button" data-action="toggle">' + (mode === "register" ? "返回登录" : "去注册") + '</button>',
                            '<button class="live2d-boss-auth-action live2d-boss-auth-ghost" type="button" data-action="back">返回</button>',
                        '</div>',
                        '<p class="live2d-boss-auth-hint">' + (mode === "register" ? "注册后可参与互动、发布评价，并使用更多专属功能。" : "还没有老板账号？点击去注册，会打开独立老板注册页。") + '</p>',
                    '</form>',
                '</div>'
            ].join("");
            result.textContent = mode === "register" ?
                "账号只用于本站互动与评价，不会影响甘雨本地记住的称呼。" :
                "老板账号使用 Supabase Auth，不会覆盖甘雨本地记忆里的称呼。";
            result.className = "live2d-quiz__result live2d-boss-auth-note is-neutral";
            showDialog();

            const form = options.querySelector(".live2d-boss-auth-form");
            const submitButton = form.querySelector('button[type="submit"]');
            const toggleButton = form.querySelector('[data-action="toggle"]');
            const backButton = form.querySelector('[data-action="back"]');

            toggleButton.addEventListener("click", function (event) {
                event.stopPropagation();
                if (mode === "register") {
                    showBossReviewAuthPanel("login", authOptions);
                    return;
                }
                openBossRegisterPage();
            });

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                if (returnToScoreGuess) {
                    showScoreGuessPanel();
                    return;
                }
                showBossReviewsPanel();
            });

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const email = form.elements.email.value.trim();
                const password = form.elements.password.value;
                const confirmPassword = mode === "register" && form.elements.confirmPassword ? form.elements.confirmPassword.value : "";

                if (!email || !password || (mode === "register" && !confirmPassword)) {
                    result.textContent = mode === "register" ? "请先把邮箱、密码和确认密码都填好哦。" : "请先填好邮箱和密码哦。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                if (mode === "register" && password !== confirmPassword) {
                    result.textContent = "两次密码不一致，请再轻轻检查一下。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                submitButton.disabled = true;
                result.textContent = mode === "register" ? "正在为你点亮老板账号……" : "正在确认老板账号……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const api = await ensureBossReviewsApi();
                    const response = mode === "register" ?
                        await api.register(email, password) :
                        await api.login(email, password);

                    if (response && response.error) {
                        result.textContent = response.error.message + (mode === "register" ? " 这个邮箱可能已经注册过了，可以直接登录试试。" : "");
                        result.className = "live2d-quiz__result is-warning";
                        return;
                    }

                    const session = await api.getSession();
                    form.reset();
                    result.textContent = mode === "register" && !(response && response.session) ?
                        "注册成功，请先去邮箱确认账号，再回来登录。" :
                        "欢迎回来，" + getBossReviewEmail(session) + "。";
                    result.className = "live2d-quiz__result is-good";
                    if (returnToScoreGuess && session && session.user) {
                        window.setTimeout(showScoreGuessPanel, 650);
                    } else if (session && session.user) {
                        window.setTimeout(function () {
                            showBossProfilePanel("欢迎回来，可以在这里确认或修改老板昵称。");
                        }, 650);
                    }
                } catch (error) {
                    result.textContent = error.message || "老板评价系统暂时不可用，请稍后再试。";
                    result.className = "live2d-quiz__result is-warning";
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        function clearBossLoginQuery() {
            if (!window.history || typeof window.history.replaceState !== "function") {
                return;
            }

            try {
                const url = new URL(window.location.href);
                if (!url.searchParams.has("bossLogin")) {
                    return;
                }

                url.searchParams.delete("bossLogin");
                const nextSearch = url.searchParams.toString();
                window.history.replaceState(null, "", url.pathname + (nextSearch ? "?" + nextSearch : "") + url.hash);
            } catch (error) {}
        }

        function clearBossRegisteredQuery() {
            if (!window.history || typeof window.history.replaceState !== "function") {
                return;
            }

            try {
                const url = new URL(window.location.href);
                if (!url.searchParams.has("bossRegistered")) {
                    return;
                }

                url.searchParams.delete("bossRegistered");
                const nextSearch = url.searchParams.toString();
                window.history.replaceState(null, "", url.pathname + (nextSearch ? "?" + nextSearch : "") + url.hash);
            } catch (error) {}
        }

        function openBossLoginFromQuery() {
            if (window.__JUNXUE_BOSS_LOGIN_QUERY_HANDLED__) {
                return;
            }

            window.__JUNXUE_BOSS_LOGIN_QUERY_HANDLED__ = true;
            clearBossLoginQuery();
            showBossReviewAuthPanel("login");
        }

        async function openBossRegisteredPromptFromQuery() {
            if (window.__JUNXUE_BOSS_REGISTERED_QUERY_HANDLED__) {
                return;
            }

            window.__JUNXUE_BOSS_REGISTERED_QUERY_HANDLED__ = true;
            clearBossRegisteredQuery();

            let api = null;
            let pending = null;
            let session = null;

            try {
                api = await ensureBossReviewsApi();
                pending = typeof api.getPendingBossRegistration === "function" ? api.getPendingBossRegistration() : null;
                session = typeof api.getSession === "function" ? await api.getSession() : null;
                if (session && session.user) {
                    if (typeof api.applyPendingBossNicknameForSession === "function") {
                        await api.applyPendingBossNicknameForSession(session);
                    }
                    return;
                }
            } catch (error) {
                console.debug("[JunxueLive2D] pending boss login prompt unavailable.");
                return;
            }

            if (!pending || pending.dismissed) {
                return;
            }

            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-weather");
            meta.textContent = "老板账号";
            question.textContent = "老板账号已经注册好啦，要现在登录这个邮箱吗？";
            options.innerHTML = [
                '<div class="boss-modal-panel">',
                    '<div class="boss-form-heading"><span class="boss-form-badge">Boss Account</span><span>登录刚刚注册的账号</span></div>',
                    '<p class="live2d-boss-auth-hint">邮箱：' + escapeHtml(pending.maskedEmail || "") + '</p>',
                    '<div class="boss-modal-actions">',
                        '<button class="live2d-quiz__option boss-modal-primary" type="button" data-action="login">去登录</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="later">稍后再说</button>',
                    '</div>',
                '</div>'
            ].join("");
            result.textContent = "不会保存密码；点击去登录后，只会帮你填好邮箱。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();

            options.querySelector('[data-action="login"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showBossReviewAuthPanel("login", { prefillEmail: pending.email });
            });
            options.querySelector('[data-action="later"]').addEventListener("click", function (event) {
                event.stopPropagation();
                if (api && typeof api.dismissPendingBossRegistration === "function") {
                    api.dismissPendingBossRegistration();
                }
                closeDialog();
            });
        }

        function handleBossLoginQuery() {
            try {
                const params = new URLSearchParams(window.location.search);
                if (params.get("bossLogin") === "1") {
                    window.setTimeout(openBossLoginFromQuery, 0);
                }
                if (params.get("bossRegistered") === "1") {
                    window.setTimeout(openBossRegisteredPromptFromQuery, 0);
                }
            } catch (error) {}
        }

        async function showBossReviewSubmitPanel() {
            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-weather", "is-boss-review");
            meta.textContent = "老板评价 · 发布评价";
            question.textContent = "谢谢你愿意把体验告诉君雪。";
            options.innerHTML = '<div class="live2d-quiz__loading">正在确认老板账号……</div>';
            result.textContent = "";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();

            let api;
            let session;

            try {
                api = await ensureBossReviewsApi();
                session = await api.getSession();
            } catch (error) {
                result.textContent = error.message || "老板评价系统暂时不可用，请稍后再试。";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (!session || !session.user) {
                options.innerHTML = '<div class="live2d-quiz__loading">请先登录后再发布评价哦～</div>';
                options.innerHTML += '<div class="live2d-weather-actions"><button class="live2d-quiz__option" type="button" data-action="login">登录/注册</button><button class="live2d-quiz__option" type="button" data-action="back">返回</button></div>';
                result.textContent = "登录后，你的评价会展示在老板评价墙里。";
                result.className = "live2d-quiz__result is-warning";
                refreshDialogPosition();
                options.querySelector('[data-action="login"]').addEventListener("click", function (event) {
                    event.stopPropagation();
                    showBossReviewAuthPanel("login");
                });
                options.querySelector('[data-action="back"]').addEventListener("click", function (event) {
                    event.stopPropagation();
                    showBossReviewsPanel();
                });
                return;
            }

            let profile = { displayName: "", warning: "" };

            if (typeof api.loadBossProfile === "function") {
                try {
                    profile = await api.loadBossProfile();
                } catch (error) {
                    profile.warning = error.message || "";
                }
            }

            const reviewNickname = normalizeBossDisplayNameInput(profile.displayName) ||
                getDisplayNameFromAuthUser(session.user) ||
                (getBossReviewEmail(session).split("@")[0] || "老板").slice(0, 20);

            options.innerHTML = [
                '<form class="boss-modal-panel live2d-boss-review-form">',
                    '<div class="boss-form-heading"><span class="boss-form-badge">★ 老板评价</span><span>把这次体验写下来吧。</span></div>',
                    '<div class="boss-form-grid">',
                        '<input class="live2d-weather-input boss-form-control" name="nickname" maxlength="20" placeholder="昵称（最多 20 字）" value="' + escapeHtml(reviewNickname) + '">',
                        '<select class="live2d-weather-input boss-form-control" name="serviceType">',
                            '<option>王者荣耀</option>',
                            '<option>永劫无间</option>',
                            '<option>语音聊天</option>',
                            '<option>其它</option>',
                        '</select>',
                        '<select class="live2d-weather-input boss-form-control" name="rating">',
                            '<option value="5">★★★★★ 5 星</option>',
                            '<option value="4">★★★★☆ 4 星</option>',
                            '<option value="3">★★★☆☆ 3 星</option>',
                            '<option value="2">★★☆☆☆ 2 星</option>',
                            '<option value="1">★☆☆☆☆ 1 星</option>',
                        '</select>',
                        '<div class="boss-form-stars" aria-hidden="true">★★★★★</div>',
                        '<textarea class="live2d-weather-input boss-form-control boss-form-textarea" name="message" maxlength="300" placeholder="评价内容（最多 300 字）"></textarea>',
                    '</div>',
                    '<div class="boss-modal-actions">',
                        '<button class="live2d-quiz__option boss-modal-primary" type="submit">发布评价</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                    '</div>',
                '</form>'
            ].join("");
            result.textContent = profile.warning || ("当前老板昵称：" + reviewNickname);
            result.className = "live2d-quiz__result boss-info-strip " + (profile.warning ? "is-warning" : "is-neutral");
            refreshDialogPosition();

            const form = options.querySelector(".live2d-boss-review-form");
            const submitButton = form.querySelector('button[type="submit"]');
            const backButton = form.querySelector('[data-action="back"]');

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showBossReviewsPanel();
            });

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const message = form.elements.message.value.trim();

                if (!message) {
                    result.textContent = "评价内容不能为空哦。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                submitButton.disabled = true;
                result.textContent = "正在帮你发布评价……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const response = await api.submitReview({
                        nickname: form.elements.nickname.value.trim() || reviewNickname,
                        serviceType: form.elements.serviceType.value,
                        rating: form.elements.rating.value,
                        message: message
                    });

                    if (response && response.error) {
                        result.textContent = response.error.message;
                        result.className = "live2d-quiz__result is-warning";
                        return;
                    }

                    form.reset();
                    if (typeof api.refreshReviewWall === "function") {
                        await api.refreshReviewWall();
                    }
                    if (window.JunxueGanyuTalk && typeof window.JunxueGanyuTalk.say === "function") {
                        window.JunxueGanyuTalk.say("谢谢你的评价，我会认真收好的。", { duration: 4200 });
                    }
                    showBossReviewsPanel(response && response.warning ? response.warning : "谢谢你的评价，我会认真收好的。", response && response.warning ? "is-warning" : "is-good");
                } catch (error) {
                    result.textContent = error.message || "评价发布失败，请稍后再试。";
                    result.className = "live2d-quiz__result is-warning";
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        function startQuiz() {
            setDialogMode("panel");
            recordGanyuFeature("无奖问答");
            quizState = {
                correct: 0,
                wrong: 0,
                correctStreak: 0,
                wrongStreak: 0,
                lastQuestion: null,
                currentQuestion: null,
                answered: false
            };
            renderQuizQuestion();
            showDialog();
        }

        function renderQuizQuestion() {
            const current = pickQuizQuestion();

            quizState.currentQuestion = current;
            quizState.answered = false;
            clearDialog();
            meta.textContent = "无奖竞答 · 第 " + (quizState.correct + quizState.wrong + 1) + " 题";
            question.textContent = current.question;

            current.options.forEach(function (option, index) {
                addOption(letters[index] + "：" + option, function (button) {
                    answerQuiz(index, button);
                });
            });
        }

        function answerQuiz(selectedIndex, selectedButton) {
            const current = quizState.currentQuestion;
            const optionButtons = options.querySelectorAll(".live2d-quiz__option");
            const isCorrect = current.correct.indexOf(selectedIndex) !== -1;

            if (quizState.answered) {
                return;
            }

            quizState.answered = true;
            quizState.lastQuestion = current;
            optionButtons.forEach(function (button) {
                button.disabled = true;
            });

            current.correct.forEach(function (answerIndex) {
                if (optionButtons[answerIndex]) {
                    optionButtons[answerIndex].classList.add("is-correct");
                }
            });

            if (isCorrect) {
                quizState.correct += 1;
                quizState.correctStreak += 1;
                quizState.wrongStreak = 0;
                selectedButton.classList.add("is-correct");
                result.textContent = quizState.correctStreak >= 3 ? "看来你很懂君雪呢～" : "真棒，离天才又进一步";
                result.className = "live2d-quiz__result is-good";
            } else {
                quizState.wrong += 1;
                quizState.wrongStreak += 1;
                quizState.correctStreak = 0;
                selectedButton.classList.add("is-wrong");
                result.textContent = quizState.wrongStreak >= 3 ? "你还没有君雪一半聪明哦～" : "真笨，这么简单都不会，去问问君雪吧";
                result.className = "live2d-quiz__result is-warning";
            }

            addPostAnswerActions();
        }

        function addPostAnswerActions() {
            addOption("继续挑战", renderQuizQuestion);
            addOption("换个问题", renderQuizQuestion);
            addOption("不玩了", showQuizScore);
        }

        function showQuizScore() {
            clearDialog();
            hideIdleTalk();
            showQuizExitBubble(quizExitBubble);
            playVoice(quizExitVoicePath);
            meta.textContent = "无奖竞答结算";
            question.innerHTML = "本次成绩：<br>答对 " + quizState.correct + " 题<br>答错 " + quizState.wrong + " 题";
            options.classList.add("live2d-quiz__menu");
            addOption("继续挑战", startQuiz);
            addOption("回到菜单", function () {
                showMenu();
            });
            result.textContent = quizState.correct >= quizState.wrong ? "不错嘛，君雪记下这次成绩了" : "下次再来，君雪等你反超";
            result.className = quizState.correct >= quizState.wrong ? "live2d-quiz__result is-good" : "live2d-quiz__result is-neutral";
        }

        function renderMemoryRow(label, value) {
            return '<div class="live2d-memory-row"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
        }

        function showMemoryPanel(message) {
            setDialogMode("panel");
            if (!message) {
                recordGanyuFeature("记忆面板");
            }
            const snapshot = getMemorySnapshot();
            clearDialog();
            dialog.classList.add("is-memory");
            options.classList.add("live2d-memory-panel");
            meta.textContent = "甘雨记得你";
            question.textContent = "这些是甘雨悄悄记下的事情。";
            options.innerHTML = [
                '<section class="live2d-memory-card" aria-label="甘雨记忆面板">',
                    renderMemoryRow("昵称", getMemoryText(snapshot.userName, "还没有告诉甘雨")),
                    renderMemoryRow("累计访问次数", String(snapshot.visitCount || 0) + "次"),
                    renderMemoryRow("连续访问", String(snapshot.streakDays || 1) + "天"),
                    renderMemoryRow("认识甘雨", "已经认识你" + String(snapshot.daysKnown || 1) + "天啦。"),
                    renderMemoryRow("第一次访问时间", formatMemoryTime(snapshot.firstVisitAt)),
                    renderMemoryRow("上次访问时间", formatMemoryTime(snapshot.lastVisitAt)),
                    renderMemoryRow("最近使用功能", getMemoryText(snapshot.lastFeature, "还没有记录")),
                    renderMemoryRow("最常查询城市", getMemoryText(snapshot.favoriteCity, "还没有记录")),
                    renderMemoryRow("最近听过歌曲", getMemoryText(snapshot.lastSongTitle, "还没有记录")),
                    renderMemoryRow("最近占卜结果", getMemoryText(snapshot.lastFortune, "还没有记录")),
                '</section>',
                '<div class="live2d-memory-actions">',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="name">修改称呼</button>',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="clear-preferences">清除偏好</button>',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="reset">重置全部记忆</button>',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="menu">回到菜单</button>',
                '</div>'
            ].join("");

            options.querySelectorAll("[data-memory-action]").forEach(function (button) {
                button.addEventListener("click", function (event) {
                    const memory = getGanyuMemory();
                    const action = button.dataset.memoryAction;

                    event.stopPropagation();

                    if (action === "name") {
                        closeDialog();
                        if (memory && typeof memory.showNamePrompt === "function") {
                            memory.showNamePrompt();
                        }
                        return;
                    }

                    if (action === "clear-preferences") {
                        if (memory && typeof memory.clearPreferences === "function") {
                            memory.clearPreferences();
                        }
                        showMemoryPanel("偏好已经清空啦，甘雨会重新慢慢了解你。");
                        return;
                    }

                    if (action === "reset") {
                        if (window.confirm("真的要让甘雨忘记这些吗？")) {
                            if (memory && typeof memory.resetAllMemory === "function") {
                                memory.resetAllMemory();
                            }
                            closeDialog();
                        }
                        return;
                    }

                    if (action === "menu") {
                        showMenu();
                    }
                });
            });

            const safeMessage = safeText(message, "");
            result.textContent = safeMessage || "如果想重新开始，也可以告诉甘雨。";
            result.className = safeMessage ? "live2d-quiz__result is-good" : "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showConsultPanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "咨询";
            question.textContent = "君雪可以帮你看看这些事情。";
            options.classList.add("live2d-consult-grid");
            addConsultCard("收费咨询", "价目与服务", false, function () {
                recordGanyuFeature("收费咨询");
                window.location.href = "price.html";
            });
            addConsultCard("老板号注册", "注册老板账号", false, function () {
                recordGanyuFeature("老板号注册");
                showBossRegisterPanel();
            });
            addConsultCard("老板资料", "修改老板昵称", false, function () {
                recordGanyuFeature("老板资料");
                showBossProfilePanel();
            });
            addConsultCard("老板评价", "查看与发布", false, function () {
                showBossReviewsPanel();
            });
            addConsultCard("敬请期待", "更多咨询", false, function () {
                recordGanyuFeature("更多咨询");
                result.textContent = "这个咨询入口还在准备中，之后会慢慢补上～";
                result.className = "live2d-quiz__result is-neutral";
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "想先看看哪一项呢？";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function addConsultCard(title, description, disabled, onClick) {
            const button = document.createElement("button");
            button.className = "live2d-consult-card";
            button.type = "button";
            button.disabled = disabled;
            button.innerHTML = '<span class="live2d-consult-card__title">' + escapeHtml(title) + '</span><span class="live2d-consult-card__desc">' + escapeHtml(description) + '</span>';

            if (!disabled && typeof onClick === "function") {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    onClick();
                });
            }

            options.appendChild(button);
            return button;
        }

        function randomItem(items) {
            return items[Math.floor(Math.random() * items.length)];
        }

        function getGanyuMemory() {
            return window.JunxueGanyuMemory || null;
        }

        function getMemorySnapshot() {
            const memory = getGanyuMemory();

            if (memory && typeof memory.getSnapshot === "function") {
                return memory.getSnapshot();
            }

            return {};
        }

        function recordGanyuFeature(name) {
            const memory = getGanyuMemory();

            if (memory && typeof memory.recordFeature === "function") {
                memory.recordFeature(name);
            }
        }

        function formatMemoryTime(value) {
            if (!value) {
                return "还没有记录";
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return value;
            }

            return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日 " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
        }

        function getMemoryText(value, fallback) {
            return value ? String(value) : fallback;
        }

        function getAllHeroes() {
            return Object.keys(heroPools).reduce(function (heroes, lane) {
                return heroes.concat(heroPools[lane]);
            }, []);
        }

        function getTodayKey() {
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");

            return fortuneStorageKeyPrefix + now.getFullYear() + "-" + month + "-" + day;
        }

        function readTodayFortune() {
            try {
                const rawFortune = localStorage.getItem(getTodayKey());

                return rawFortune ? JSON.parse(rawFortune) : null;
            } catch (error) {
                return null;
            }
        }

        function saveTodayFortune(fortune) {
            try {
                localStorage.setItem(getTodayKey(), JSON.stringify(fortune));
                return true;
            } catch (error) {
                return false;
            }
        }

        function buildFortune() {
            const level = randomItem(fortuneLevels);

            return {
                level: level,
                levelClass: fortuneLevelClasses[level] || "",
                number: String(Math.floor(Math.random() * 99) + 1),
                color: randomItem(luckyColors),
                hero: randomItem(getAllHeroes()),
                song: randomItem(musicList).title,
                advice: randomItem(fortuneAdviceList),
                quote: randomItem(ganyuQuotes)
            };
        }

        function setFortuneShell() {
            clearDialog();
            dialog.classList.add("is-fortune");
            options.classList.add("live2d-fortune-panel");
            meta.textContent = "日常娱乐 · 占卜";
            question.textContent = "🌙 甘雨占卜屋";
        }

        function renderFortuneResult(fortune, message) {
            const levelClass = fortune.levelClass || fortuneLevelClasses[fortune.level] || "";
            options.innerHTML = [
                '<div class="live2d-fortune-body">',
                '<section class="live2d-fortune-list" aria-label="君雪占卜结果">',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">今日运势：</span>',
                        '<span class="live2d-fortune-value ' + levelClass + '">' + escapeHtml(fortune.level) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运数字：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.number) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运颜色：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.color) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运英雄：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.hero) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运歌曲：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.song) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">今日建议：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.advice) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item live2d-fortune-item--quote">',
                        '<span class="live2d-fortune-label">甘雨赠言：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.quote) + '</span>',
                    '</article>',
                '</section>',
                '<section class="live2d-fortune-message" aria-label="甘雨今日建议">',
                    '<div class="live2d-fortune-message__quote">' + escapeHtml(message || "星光已经落在纸上，请慢慢读完今天的答案。") + '</div>',
                '</section>',
                '</div>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="again">再占一次</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="save">保存今日占卜</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="back">返回日常娱乐</button>',
                '</div>'
            ].join("");

            options.querySelector('[data-fortune-action="again"]').addEventListener("click", function (event) {
                event.stopPropagation();
                startFortuneProcess(false);
            });
            options.querySelector('[data-fortune-action="save"]').addEventListener("click", function (event) {
                event.stopPropagation();
                const saved = saveTodayFortune(fortune);

                result.textContent = saved ? "今日占卜已经收好啦。" : "今天的占卜暂时没能保存，请稍后再试。";
                result.className = saved ? "live2d-quiz__result is-good" : "live2d-quiz__result is-warning";
            });
            options.querySelector('[data-fortune-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showEntertainmentPanel();
            });

            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();
        }

        function showFortuneResult(fortune, options) {
            const settings = options || {};

            setFortuneShell();
            renderFortuneResult(fortune, settings.message);

            if (!settings.skipEffects) {
                const memory = getGanyuMemory();

                if (memory && typeof memory.recordFortune === "function") {
                    memory.recordFortune("今日运势：" + fortune.level + "，幸运英雄：" + fortune.hero);
                }
                playVoice(fortuneVoicePath);
                showFortuneBubble(fortuneBubble);
            }
        }

        function startFortuneProcess(overwriteToday) {
            setFortuneShell();
            options.innerHTML = [
                '<div class="live2d-fortune-process" aria-live="polite">',
                    '<span class="live2d-fortune-process__moon">☾</span>',
                    '<span>甘雨正在观察星象……</span>',
                '</div>'
            ].join("");
            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();

            window.clearTimeout(fortuneProcessTimer);
            fortuneProcessTimer = window.setTimeout(function () {
                const fortune = buildFortune();

                if (overwriteToday) {
                    saveTodayFortune(fortune);
                }

                showFortuneResult(fortune);
            }, 1500);
        }

        function showFortuneSavedPrompt(savedFortune) {
            setFortuneShell();
            options.innerHTML = [
                '<div class="live2d-fortune-message live2d-fortune-message--center">',
                    '<div class="live2d-fortune-message__quote">今天已经占卜过啦，要看看之前的结果吗？</div>',
                '</div>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="view">查看今日结果</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="restart">重新占卜</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="back">返回日常娱乐</button>',
                '</div>'
            ].join("");

            options.querySelector('[data-fortune-action="view"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showFortuneResult(savedFortune, {
                    skipEffects: true,
                    message: "这是甘雨为你保存的今日占卜。"
                });
            });
            options.querySelector('[data-fortune-action="restart"]').addEventListener("click", function (event) {
                event.stopPropagation();
                startFortuneProcess(true);
            });
            options.querySelector('[data-fortune-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showEntertainmentPanel();
            });

            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();
        }

        function showFortuneIntro() {
            setFortuneShell();
            options.innerHTML = [
                '<div class="live2d-fortune-message live2d-fortune-message--center">',
                    '<div class="live2d-fortune-message__title">请把心里的问题轻轻放下。</div>',
                    '<div class="live2d-fortune-message__quote">甘雨会认真观察星象，为你写下今日的指引。</div>',
                '</div>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="start">开始占卜</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="back">返回日常娱乐</button>',
                '</div>'
            ].join("");

            options.querySelector('[data-fortune-action="start"]').addEventListener("click", function (event) {
                event.stopPropagation();
                startFortuneProcess(false);
            });
            options.querySelector('[data-fortune-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showEntertainmentPanel();
            });

            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();
        }

        function showFortunePanel() {
            setDialogMode("panel");
            recordGanyuFeature("占卜");
            const savedFortune = readTodayFortune();
            const lastFortune = getMemorySnapshot().lastFortune;

            if (savedFortune) {
                showFortuneSavedPrompt(savedFortune);
                if (lastFortune) {
                    result.textContent = "上次的占卜结果是：" + lastFortune + "。";
                    result.className = "live2d-quiz__result is-neutral";
                }
                return;
            }

            showFortuneIntro();
            if (lastFortune) {
                result.textContent = "上次的占卜结果是：" + lastFortune + "。";
                result.className = "live2d-quiz__result is-neutral";
            }
        }

        function getCurrentMusic() {
            return musicList[currentMusicIndex] || musicList[0];
        }

        function applyLastSongPreference() {
            const snapshot = getMemorySnapshot();

            if (musicPlaying || !snapshot.lastSongSrc) {
                return "";
            }

            const lastIndex = musicList.findIndex(function (music) {
                return music.src === snapshot.lastSongSrc;
            });

            if (lastIndex >= 0) {
                currentMusicIndex = lastIndex;
            }

            return snapshot.lastSongTitle || "";
        }

        function syncMusicAudioSource() {
            const currentMusic = getCurrentMusic();
            const audio = ensureMusicAudio();

            if (!currentMusic || audio.getAttribute("src") === currentMusic.src) {
                return;
            }

            audio.src = currentMusic.src;
        }

        function renderMusicPlayerContent() {
            const currentMusic = getCurrentMusic();
            const listHtml = musicList.map(function (music, index) {
                const isCurrent = index === currentMusicIndex ? " is-current" : "";
                const artistText = music.artist ? " · " + music.artist : "";

                return '<button class="live2d-music-track' + isCurrent + '" type="button" data-music-index="' + index + '">' + escapeHtml(music.title + artistText) + '</button>';
            }).join("");
            const currentArtistText = currentMusic && currentMusic.artist ? " · " + currentMusic.artist : "";
            const currentStatus = musicPlaying ? "播放中" : "待播放";

            options.innerHTML = [
                '<div class="live2d-music-player">',
                    '<div class="live2d-music-current">当前播放：<span>' + escapeHtml(currentMusic ? currentMusic.title + currentArtistText : "暂无歌曲") + '</span><small> · ' + currentStatus + '</small></div>',
                    '<div class="live2d-music-list" aria-label="歌曲列表">' + listHtml + '</div>',
                    '<div class="live2d-music-controls">',
                        '<button class="live2d-wheel__small" type="button" data-music-action="prev">上一首</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="toggle">' + (musicPlaying ? "暂停" : "播放") + '</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="next">下一首</button>',
                    '</div>',
                    '<div class="live2d-music-actions">',
                        '<button class="live2d-wheel__small" type="button" data-music-action="back">返回日常娱乐</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="menu">回到菜单</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="close">关闭歌曲</button>',
                    '</div>',
                '</div>'
            ].join("");

            bindMusicPlayerActions();
        }

        function playCurrentMusic() {
            const currentMusic = getCurrentMusic();

            if (!currentMusic) {
                return;
            }

            syncMusicAudioSource();
            ensureMusicAudio().play().then(function () {
                musicPlaying = true;
                const memory = getGanyuMemory();

                if (memory && typeof memory.recordSong === "function") {
                    memory.recordSong(currentMusic.title, currentMusic.src);
                }
                refreshMusicPlayerContent();
            }).catch(function (error) {
                console.warn("[JunxueMusic] Audio play failed:", currentMusic.src, error);
                musicPlaying = false;
                result.textContent = "这首歌暂时播放不了，换一首试试吧～";
                result.className = "live2d-quiz__result is-warning";
                refreshMusicPlayerContent();
            });
        }

        function pauseCurrentMusic() {
            if (musicAudio) {
                musicAudio.pause();
            }
            musicPlaying = false;
            refreshMusicPlayerContent();
        }

        function selectMusic(index, shouldPlay) {
            if (!musicList.length) {
                return;
            }

            currentMusicIndex = (index + musicList.length) % musicList.length;
            if (musicAudio) {
                musicAudio.pause();
                musicAudio.removeAttribute("src");
                musicAudio.load();
            }
            musicPlaying = false;
            refreshMusicPlayerContent();

            if (shouldPlay) {
                playCurrentMusic();
            }
        }

        function bindMusicPlayerActions() {
            options.querySelectorAll("[data-music-index]").forEach(function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    selectMusic(Number(button.dataset.musicIndex), true);
                });
            });

            options.querySelectorAll("[data-music-action]").forEach(function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    const action = button.dataset.musicAction;

                    if (action === "toggle") {
                        if (musicPlaying) {
                            pauseCurrentMusic();
                            return;
                        }

                        playCurrentMusic();
                        return;
                    }

                    if (action === "prev") {
                        selectMusic(currentMusicIndex - 1, musicPlaying);
                        return;
                    }

                    if (action === "next") {
                        selectMusic(currentMusicIndex + 1, musicPlaying);
                        return;
                    }

                    if (action === "close") {
                        closeCurrentMusic();
                        return;
                    }

                    if (action === "back") {
                        showEntertainmentPanel();
                        return;
                    }

                    if (action === "menu") {
                        showMenu();
                    }
                });
            });
        }

        function showMusicPlayer() {
            setDialogMode("panel");
            recordGanyuFeature("听歌");
            const lastSongTitle = applyLastSongPreference();

            clearDialog();
            dialog.classList.add("is-music");
            options.classList.add("live2d-music-panel");
            meta.textContent = "日常娱乐 · 听歌";
            question.innerHTML = '<span class="live2d-music-title">♪ 听歌</span><span class="live2d-music-subtitle">甘雨想和你分享一些音乐呢～</span>';
            renderMusicPlayerContent();
            result.textContent = lastSongTitle ? "上次听到的是《" + lastSongTitle + "》，还想继续吗？歌曲文件较大，首次播放可能需要等待几秒。" : "需要你点播放，甘雨才会开始放歌。歌曲文件较大，首次播放可能需要等待几秒。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showWeatherInput() {
            setDialogMode("panel");
            recordGanyuFeature("天气");
            const favoriteCity = getMemorySnapshot().favoriteCity || "";

            clearDialog();
            dialog.classList.add("is-weather");
            options.classList.add("live2d-weather-panel");
            meta.textContent = "日常娱乐 · 查看天气";
            question.textContent = "请输入你想查询天气的城市";
            options.innerHTML = [
                '<form class="live2d-weather-form">',
                    '<input class="live2d-weather-input" type="text" name="city" placeholder="例如：北京 / 上海 / 杭州" autocomplete="off">',
                    '<button class="live2d-weather-submit" type="submit">查询</button>',
                '</form>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回日常娱乐</button>',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="menu">回到菜单</button>',
                '</div>'
            ].join("");

            const form = options.querySelector(".live2d-weather-form");
            const cityInput = options.querySelector(".live2d-weather-input");
            const backButton = options.querySelector('[data-weather-action="back"]');
            const menuButton = options.querySelector('[data-weather-action="menu"]');

            if (favoriteCity) {
                cityInput.value = favoriteCity;
            }

            form.addEventListener("submit", function (event) {
                event.preventDefault();
                const cityName = cityInput.value.trim();

                if (!cityName) {
                    result.textContent = "先告诉君雪城市名哦～";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                fetchWeather(cityName);
            });
            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showEntertainmentPanel();
            });
            menuButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showMenu();
            });

            result.textContent = favoriteCity ? "今天还想看看" + favoriteCity + "的天气吗？" : "哼，可不是特意帮你查天气哦～只是顺手看看那边有没有下雨而已。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
            window.setTimeout(function () {
                cityInput.focus();
            }, 80);
        }

        async function fetchWeather(cityName) {
            const normalizedCity = normalizeCityName(cityName);
            const fallbackPlace = cityFallbackMap[normalizedCity];
            const encodedCity = encodeURIComponent(cityName);
            const geocodeUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodedCity + "&count=1&language=zh&format=json";

            result.textContent = "君雪正在翻天气书...";
            result.className = "live2d-quiz__result is-neutral";

            try {
                if (fallbackPlace) {
                    const fallbackForecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(fallbackPlace.latitude) + "&longitude=" + encodeURIComponent(fallbackPlace.longitude) + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=3";
                    const fallbackForecastResponse = await fetch(fallbackForecastUrl);

                    if (!fallbackForecastResponse.ok) {
                        throw new Error("weather-request-failed");
                    }

                    const fallbackForecastData = await fallbackForecastResponse.json();
                    if (window.JunxueGanyuMemory && typeof window.JunxueGanyuMemory.recordWeatherCity === "function") {
                        window.JunxueGanyuMemory.recordWeatherCity(fallbackPlace.name || cityName);
                    }
                    renderWeatherCard(fallbackPlace, fallbackForecastData.daily || {});
                    return;
                }

                const geoResponse = await fetch(geocodeUrl);

                if (!geoResponse.ok) {
                    throw new Error("weather-request-failed");
                }

                const geoData = await geoResponse.json();

                if (!geoData.results || !geoData.results.length) {
                    result.textContent = "君雪没有找到这个地方哦～";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                const place = geoData.results[0];
                const forecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(place.latitude) + "&longitude=" + encodeURIComponent(place.longitude) + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=3";
                const forecastResponse = await fetch(forecastUrl);

                if (!forecastResponse.ok) {
                    throw new Error("weather-request-failed");
                }

                const forecastData = await forecastResponse.json();
                if (window.JunxueGanyuMemory && typeof window.JunxueGanyuMemory.recordWeatherCity === "function") {
                    window.JunxueGanyuMemory.recordWeatherCity(place.name || cityName);
                }
                renderWeatherCard(place, forecastData.daily || {});
            } catch (error) {
                result.textContent = "天气被云层挡住啦，稍后再试吧～";
                result.className = "live2d-quiz__result is-warning";
            }
        }

        function getWeatherDialogue(code) {
            if ([71, 73, 75, 77, 85, 86].indexOf(code) >= 0) {
                return {
                    text: "天气有些冷呢，记得多添一件衣服。",
                    voice: "assets/audio/ganyu_weather_snow.mp3"
                };
            }

            if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].indexOf(code) >= 0) {
                return {
                    text: "记得带伞哦，路上也要小心。",
                    voice: "assets/audio/ganyu_weather_rain.mp3"
                };
            }

            if ([0, 1, 2].indexOf(code) >= 0) {
                return {
                    text: "今天适合出门走走呢。",
                    voice: "assets/audio/ganyu_weather_sunny.mp3"
                };
            }

            return {
                text: "天气变化不定，出门前再确认一下会更安心。",
                voice: "assets/audio/ganyu_weather_cloudy.mp3"
            };
        }

        function showWeatherDialogue(code) {
            if (!window.JunxueGanyuTalk || typeof window.JunxueGanyuTalk.say !== "function") {
                return;
            }

            const dialogue = getWeatherDialogue(code);

            window.JunxueGanyuTalk.say(dialogue.text, dialogue.voice, 5200);
        }

        function renderWeatherCard(place, daily) {
            const cityTitle = [place.name, place.admin1, place.country].filter(Boolean).join(" · ");
            const dates = daily.time || [];
            const maxTemps = daily.temperature_2m_max || [];
            const minTemps = daily.temperature_2m_min || [];
            const codes = daily.weather_code || [];
            const rows = [0, 1, 2].map(function (index) {
                return [
                    '<article class="live2d-weather-day">',
                        '<div class="live2d-weather-day__label">' + getDayLabel(index) + '</div>',
                        '<div class="live2d-weather-day__date">' + escapeHtml(dates[index] || "") + '</div>',
                        '<div class="live2d-weather-day__status">' + escapeHtml(getWeatherLabel(codes[index])) + '</div>',
                        '<div class="live2d-weather-day__temp">' + formatTemperature(maxTemps[index]) + ' / ' + formatTemperature(minTemps[index]) + '</div>',
                        '<div class="live2d-weather-day__rain">' + escapeHtml(getPrecipitationText(daily, index)) + '</div>',
                    '</article>'
                ].join("");
            }).join("");

            function bindWeatherActions() {
                const againButton = options.querySelector('[data-weather-action="again"]');
                const backButton = options.querySelector('[data-weather-action="back"]');
                const calendarButton = options.querySelector('[data-weather-action="calendar"]');
                const weatherButton = options.querySelector('[data-weather-action="weather"]');

                if (againButton) {
                    againButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        showWeatherInput();
                    });
                }

                if (backButton) {
                    backButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        showEntertainmentPanel();
                    });
                }

                if (calendarButton) {
                    calendarButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        renderCalendarPage();
                    });
                }

                if (weatherButton) {
                    weatherButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        renderForecastPage();
                    });
                }
            }

            function getCalendarInfo() {
                const now = new Date();
                const day = now.getDay();
                const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
                const isRestDay = day === 0 || day === 6;

                return {
                    dateText: now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日",
                    weekdayText: weekdays[day],
                    statusText: isRestDay ? "休息日" : "工作日",
                    monthText: now.getFullYear() + "年" + (now.getMonth() + 1) + "月",
                    tipText: pickRandomItem(ganyuCalendarTips)
                };
            }

            function renderForecastPage() {
                meta.textContent = "日常娱乐 · 查看天气";
                question.textContent = cityTitle;
                options.innerHTML = [
                    '<section class="live2d-weather-page" aria-label="三天天气预报">',
                        '<button class="live2d-weather-flip" type="button" data-weather-action="calendar" aria-label="查看甘雨日历">📅</button>',
                        '<div class="live2d-weather-card">',
                            rows,
                        '</div>',
                    '</section>',
                    '<div class="live2d-weather-actions">',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="again">换个城市</button>',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回日常娱乐</button>',
                    '</div>'
                ].join("");
                bindWeatherActions();
            }

            function renderCalendarPage() {
                const calendar = getCalendarInfo();

                meta.textContent = "日常娱乐 · 甘雨日历";
                question.textContent = "甘雨日历";
                options.innerHTML = [
                    '<section class="live2d-weather-page" aria-label="甘雨日历">',
                        '<button class="live2d-weather-flip" type="button" data-weather-action="weather" aria-label="返回天气预报">↩</button>',
                        '<div class="live2d-calendar-card">',
                            '<h3>甘雨日历</h3>',
                            '<div class="live2d-calendar-row"><span>今天是：</span><strong>' + escapeHtml(calendar.dateText) + '</strong></div>',
                            '<div class="live2d-calendar-row"><span>星期：</span><strong>' + escapeHtml(calendar.weekdayText) + '</strong></div>',
                            '<div class="live2d-calendar-row"><span>状态：</span><strong>' + escapeHtml(calendar.statusText) + '</strong></div>',
                            '<div class="live2d-calendar-row"><span>当前月份：</span><strong>' + escapeHtml(calendar.monthText) + '</strong></div>',
                            '<div class="live2d-calendar-tip"><span>甘雨提示：</span><p>' + escapeHtml(calendar.tipText) + '</p></div>',
                        '</div>',
                    '</section>',
                    '<div class="live2d-weather-actions">',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="again">换个城市</button>',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回日常娱乐</button>',
                    '</div>'
                ].join("");
                bindWeatherActions();
            }

            clearDialog();
            dialog.classList.add("is-weather");
            options.classList.add("live2d-weather-panel");
            renderForecastPage();
            result.textContent = "天气小卡片准备好了。";
            result.className = "live2d-quiz__result is-good";
            showDialog();
            showWeatherDialogue(codes[0]);
        }

        function showHeroWheel() {
            setDialogMode("panel");
            recordGanyuFeature("英雄池");
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
                    '</div>',
                    '<div class="live2d-wheel__hero" aria-live="polite">准备抽取</div>',
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
        }

        function bindLive2DRoots() {
            findLive2DRoots().forEach(bindNode);
        }

        window.addEventListener("live2d-stage-position-changed", scheduleLive2DPopupPositions);
        window.addEventListener("resize", scheduleLive2DPopupPositions);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) {
                scheduleLive2DPopupPositions();
            }
        });
        window.setTimeout(syncLive2DPopupPositions, 500);
        window.setTimeout(syncLive2DPopupPositions, 1500);
        window.setTimeout(syncLive2DPopupPositions, 3000);
        scheduleIdleTalk(true);

        closeButton.addEventListener("click", function (event) {
            event.stopPropagation();
            closeDialog();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeDialog();
            }
        });

        window.Live2DInteractiveMenu = {
            ready: true,
            open: showMenu,
            openBossReviews: showBossReviewsPanel,
            openBossLogin: openBossLoginFromQuery,
            openBossRegisteredPrompt: openBossRegisteredPromptFromQuery,
            sync: syncLive2DPopupPositions
        };
        handleBossLoginQuery();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initInteractions);
        return;
    }

    initInteractions();
})();
