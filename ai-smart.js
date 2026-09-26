/* ============================================================
   CLOUDORA AI 3.0 — SMART CONTEXT LAYER
   ------------------------------------------------------------
   Provides:
   - Conversation memory
   - Context tracking
   - Follow-up detection helpers
   - Smart suggestions
   - Context UI

   IMPORTANT:
   AI 3.0 DOES NOT ANSWER CHAT MESSAGES.
   Cloudora AI 4.1 is the single answer authority.
   ============================================================ */

(() => {
    "use strict";

    const STORAGE_KEY = "cloudoraAI3Context";
    const MAX_HISTORY = 8;

    let history = [];

    const $ = id => document.getElementById(id);

    /* ---------------------------------------------------------
       INITIALIZATION
    --------------------------------------------------------- */

    function init() {
        if (
            !$("chatMessages") ||
            !$("chatInput") ||
            !$("chatBtn")
        ) {
            setTimeout(init, 500);
            return;
        }

        loadContext();

        /*
         * IMPORTANT:
         * Do NOT install AI 3.0 answer interception.
         *
         * ai-engine.js owns the chat.
         * Cloudora AI 4.1 generates the answer.
         */

        installEnterBridge();

        addSmartChrome();
        updateContextLabel();

        console.log(
            "Cloudora AI 3.0 — Smart Context loaded."
        );
    }

    /* ---------------------------------------------------------
       ENTER KEY BRIDGE
       ---------------------------------------------------------
       Pressing Enter performs exactly the same action as
       clicking the Send button.

       This does NOT generate an answer itself.
       It simply forwards the action to ai-engine.js.
    --------------------------------------------------------- */

    function installEnterBridge() {
        const input = $("chatInput");
        const button = $("chatBtn");

        if (!input || !button) {
            setTimeout(
                installEnterBridge,
                500
            );

            return;
        }

        if (
            input.dataset
                .cloudoraEnterBridge ===
            "true"
        ) {
            return;
        }

        input.dataset
            .cloudoraEnterBridge =
            "true";

        input.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !== "Enter" ||
                    event.shiftKey
                ) {
                    return;
                }

                /*
                 * Let normal Enter submit the chat.
                 * Shift + Enter remains available for
                 * multiline input.
                 */
                event.preventDefault();

                button.click();
            }
        );

        console.log(
            "Cloudora chat Enter key enabled."
        );
    }

    /* ---------------------------------------------------------
       LOCAL CONTEXT
    --------------------------------------------------------- */

    function loadContext() {
        try {
            history = JSON.parse(
                localStorage.getItem(
                    STORAGE_KEY
                ) || "[]"
            );

            if (!Array.isArray(history)) {
                history = [];
            }
        } catch {
            history = [];
        }
    }

    function saveContext() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    history.slice(
                        -MAX_HISTORY
                    )
                )
            );
        } catch {
            // Storage may be unavailable.
        }
    }

    function remember(
        question,
        answer,
        meta = {}
    ) {
        history.push({
            question,
            answer:
                stripHTML(
                    answer
                ),
            timestamp:
                Date.now(),
            intent:
                meta.intent ||
                detectIntent(
                    question
                ),
            topic:
                meta.topic ||
                detectTopic(
                    question
                ),
            timeReference:
                meta.timeReference ||
                detectTimeReference(
                    question
                )
        });

        history =
            history.slice(
                -MAX_HISTORY
            );

        saveContext();
        updateContextLabel();
    }

    /* ---------------------------------------------------------
       CONTEXT DETECTION
    --------------------------------------------------------- */

    function detectTimeReference(q) {
        const text =
            normalize(q);

        if (
            /\bday after tomorrow\b/.test(
                text
            )
        ) {
            return "day-after-tomorrow";
        }

        if (
            /\btomorrow\b/.test(
                text
            )
        ) {
            return "tomorrow";
        }

        if (
            /\btonight\b/.test(
                text
            )
        ) {
            return "tonight";
        }

        if (
            /\btoday\b|\bright now\b|\bcurrently\b/.test(
                text
            )
        ) {
            return "today";
        }

        if (
            /\bthis weekend\b|\bweekend\b/.test(
                text
            )
        ) {
            return "weekend";
        }

        if (
            /\bthis evening\b|\bevening\b/.test(
                text
            )
        ) {
            return "evening";
        }

        if (
            /\bthis morning\b|\bmorning\b/.test(
                text
            )
        ) {
            return "morning";
        }

        if (
            /\bafternoon\b/.test(
                text
            )
        ) {
            return "afternoon";
        }

        return null;
    }

    function detectTopic(q) {
        const text =
            normalize(q);

        if (
            /rain|rainy|raining|precipitation|umbrella/.test(
                text
            )
        ) {
            return "rain";
        }

        if (
            /temperature|temp|hot|cold|warm|cool|heat/.test(
                text
            )
        ) {
            return "temperature";
        }

        if (
            /wind|windy|gust/.test(
                text
            )
        ) {
            return "wind";
        }

        if (
            /humidity|humid|sticky/.test(
                text
            )
        ) {
            return "humidity";
        }

        if (
            /air quality|aqi|pollution|pm2/.test(
                text
            )
        ) {
            return "air";
        }

        if (
            /uv|sunburn|sunscreen|sun protection/.test(
                text
            )
        ) {
            return "uv";
        }

        if (
            /wear|clothes|outfit|jacket|shirt|clothing/.test(
                text
            )
        ) {
            return "clothing";
        }

        if (
            /outside|outdoor|walk|run|running|cycling|bike|hike|picnic|exercise/.test(
                text
            )
        ) {
            return "outdoor";
        }

        if (
            /travel|trip|drive|driving|commute/.test(
                text
            )
        ) {
            return "travel";
        }

        if (
            /sunrise|dawn/.test(
                text
            )
        ) {
            return "sunrise";
        }

        if (
            /sunset|dusk/.test(
                text
            )
        ) {
            return "sunset";
        }

        if (
            /weather|forecast|conditions/.test(
                text
            )
        ) {
            return "weather";
        }

        return "general";
    }

    function detectIntent(q) {
        const text =
            normalize(q);

        if (
            /umbrella/.test(
                text
            )
        ) {
            return "umbrella";
        }

        if (
            /rain|raining|precipitation/.test(
                text
            )
        ) {
            return "rain";
        }

        if (
            /temperature|temp|hot|cold|warm|cool|heat/.test(
                text
            )
        ) {
            return "temperature";
        }

        if (
            /air quality|aqi|pollution|pm2/.test(
                text
            )
        ) {
            return "air";
        }

        if (
            /outdoor|outside|walk|run|cycling|bike|hike|exercise/.test(
                text
            )
        ) {
            return "outdoor";
        }

        if (
            /wear|clothes|outfit|jacket|shirt|clothing/.test(
                text
            )
        ) {
            return "clothing";
        }

        if (
            /wind|windy|gust/.test(
                text
            )
        ) {
            return "wind";
        }

        if (
            /humidity|humid|sticky/.test(
                text
            )
        ) {
            return "humidity";
        }

        if (
            /uv|sunburn|sunscreen/.test(
                text
            )
        ) {
            return "uv";
        }

        if (
            /sunrise|dawn/.test(
                text
            )
        ) {
            return "sunrise";
        }

        if (
            /sunset|dusk/.test(
                text
            )
        ) {
            return "sunset";
        }

        return "general";
    }

    function getLastContext() {
        return history.length
            ? history[
                history.length - 1
            ]
            : null;
    }

    /* ---------------------------------------------------------
       SMART FOLLOW-UP DETECTION
       ---------------------------------------------------------
       These functions are retained for context analysis.

       They DO NOT intercept chat submission.
       AI 4.1 receives the actual question.
    --------------------------------------------------------- */

    function isFollowUp(question) {
        const text =
            normalize(question);

        if (!history.length) {
            return false;
        }

        return (
            /^(what about|how about|and what about|and|then what|what if)\b/.test(
                text
            ) ||
            /^(morning|evening|afternoon|tonight|tomorrow|later)\b/.test(
                text
            ) ||
            /^(why|when|where|how much|how long)\b/.test(
                text
            ) ||
            /^(is it|will it|should i|can i)\b/.test(
                text
            ) ||
            /^(there|that|this|it)\b/.test(
                text
            )
        );
    }

    function contextualize(question) {
        const last =
            getLastContext();

        if (!last) {
            return {
                handled: false,
                question
            };
        }

        const text =
            normalize(question);

        const lastTime =
            last.timeReference;

        const lastTopic =
            last.topic;

        if (
            /\bwhat about tomorrow\b|\band tomorrow\b|\bhow about tomorrow\b/.test(
                text
            )
        ) {
            return {
                handled: true,
                type: "standard",
                question:
                    buildExplicitQuestion(
                        lastTopic,
                        "tomorrow"
                    )
            };
        }

        if (
            /\bwhat about evening\b|\bhow about evening\b|\bevening\b/.test(
                text
            )
        ) {
            return {
                handled: true,
                type: "time",
                time: "evening",
                previousTime:
                    lastTime,
                topic:
                    lastTopic
            };
        }

        if (
            /\bwhat about morning\b|\bhow about morning\b|\bmorning\b/.test(
                text
            )
        ) {
            return {
                handled: true,
                type: "time",
                time: "morning",
                previousTime:
                    lastTime,
                topic:
                    lastTopic
            };
        }

        if (
            /\bwhat about afternoon\b|\bhow about afternoon\b/.test(
                text
            )
        ) {
            return {
                handled: true,
                type: "time",
                time: "afternoon",
                previousTime:
                    lastTime,
                topic:
                    lastTopic
            };
        }

        if (
            /\bwhat about tonight\b|\bhow about tonight\b/.test(
                text
            )
        ) {
            return {
                handled: true,
                type: "time",
                time: "tonight",
                previousTime:
                    lastTime,
                topic:
                    lastTopic
            };
        }

        if (
            /^(is it good|is it okay|is it fine|should i|can i|will it be okay)/.test(
                text
            )
        ) {
            return {
                handled: true,
                type: "topic",
                topic:
                    lastTopic,
                time:
                    lastTime ||
                    "today"
            };
        }

        return {
            handled: false,
            question
        };
    }

    function buildExplicitQuestion(
        topic,
        time
    ) {
        const subject = {
            rain: "rain",
            temperature:
                "temperature",
            wind: "wind",
            humidity:
                "humidity",
            air: "air quality",
            uv: "UV",
            clothing:
                "what should I wear",
            outdoor:
                "outdoor conditions",
            travel:
                "travel conditions",
            weather:
                "weather"
        }[topic] || "weather";

        if (
            subject ===
            "what should I wear"
        ) {
            return `What should I wear ${time}?`;
        }

        return `What is the ${subject} ${time}?`;
    }

    /* ---------------------------------------------------------
       WEATHER DATA ACCESS
    --------------------------------------------------------- */

    function getWeatherContext() {
        if (
            typeof weatherData ===
                "undefined" ||
            !weatherData ||
            !weatherData.current
        ) {
            return null;
        }

        const hourly =
            weatherData.hourly ||
            {};

        const index =
            typeof getCurrentHourlyIndex ===
            "function"
                ? getCurrentHourlyIndex()
                : 0;

        const unit =
            typeof temperatureUnit !==
                "undefined" &&
            temperatureUnit ===
                "fahrenheit"
                ? "°F"
                : "°C";

        const hours = [];

        for (
            let i = index;
            i <
            Math.min(
                index + 24,
                hourly.time?.length ||
                    0
            );
            i++
        ) {
            hours.push({
                time:
                    hourly.time?.[
                        i
                    ],

                temp:
                    num(
                        hourly.temperature_2m?.[
                            i
                        ]
                    ),

                feels:
                    num(
                        hourly.apparent_temperature?.[
                            i
                        ]
                    ),

                rain:
                    num(
                        hourly.precipitation_probability?.[
                            i
                        ]
                    ),

                precipitation:
                    num(
                        hourly.precipitation?.[
                            i
                        ]
                    ),

                wind:
                    num(
                        hourly.wind_speed_10m?.[
                            i
                        ]
                    ),

                uv:
                    num(
                        hourly.uv_index?.[
                            i
                        ]
                    ),

                humidity:
                    num(
                        hourly.relative_humidity_2m?.[
                            i
                        ]
                    ),

                code:
                    num(
                        hourly.weather_code?.[
                            i
                        ]
                    )
            });
        }

        return {
            city:
                typeof currentCity !==
                "undefined"
                    ? currentCity?.name ||
                      "your location"
                    : "your location",

            unit,
            hours
        };
    }

    /* ---------------------------------------------------------
       SMART SCORING
    --------------------------------------------------------- */

    function findBestHour(
        hours
    ) {
        if (!hours.length) {
            return null;
        }

        return [...hours]
            .map(h => {
                const rainPenalty =
                    Math.min(
                        h.rain || 0,
                        80
                    ) * 0.55;

                const windPenalty =
                    Math.max(
                        0,
                        (h.wind || 0) -
                            18
                    ) * 1.2;

                const uvPenalty =
                    Math.max(
                        0,
                        (h.uv || 0) -
                            7
                    ) * 3;

                const heatPenalty =
                    h.temp >= 35
                        ? 16
                        : h.temp >= 32
                            ? 8
                            : 0;

                return {
                    ...h,

                    score:
                        rainPenalty +
                        windPenalty +
                        uvPenalty +
                        heatPenalty
                };
            })
            .sort(
                (a, b) =>
                    a.score -
                    b.score
            )[0];
    }

    function comfortSentence(
        temp
    ) {
        if (temp >= 36) {
            return "It will feel quite hot, so shade and hydration will matter.";
        }

        if (temp >= 31) {
            return "It should feel warm to hot, especially in direct sun.";
        }

        if (temp >= 24) {
            return "That is generally a comfortable range for many outdoor activities.";
        }

        if (temp >= 17) {
            return "That is a fairly mild range for most people.";
        }

        if (temp >= 10) {
            return "It will feel cool, especially if you're outside for a while.";
        }

        return "That's cold enough that warm layers are worth considering.";
    }

    function outdoorSentence(h) {
        if (!h) {
            return "";
        }

        if (h.rain >= 60) {
            return "I'd be cautious about outdoor plans because of the higher rain risk.";
        }

        if (h.wind >= 35) {
            return "The stronger wind may make outdoor activities less comfortable.";
        }

        if (h.temp >= 34) {
            return "The heat may make longer outdoor activity uncomfortable.";
        }

        if (h.uv >= 7) {
            return "Outdoor plans look more comfortable with sun protection.";
        }

        return "That looks like one of the more comfortable periods for being outside.";
    }

    function clothingSentence(
        h,
        context
    ) {
        if (!h) {
            return "";
        }

        if (h.temp >= 32) {
            return "I'd choose light, breathable clothing.";
        }

        if (h.temp >= 24) {
            return "A normal light outfit should work well.";
        }

        if (h.temp >= 17) {
            return "A light extra layer could be useful.";
        }

        return "I'd go with warmer layers.";
    }

    /* ---------------------------------------------------------
       SMART FOLLOW-UP RESPONSE HELPERS
       ---------------------------------------------------------
       Kept for compatibility with the AI3 context system.
       These are NOT directly connected to the Send button.
    --------------------------------------------------------- */

    function handleTimeQuestion(
        info
    ) {
        const context =
            getWeatherContext();

        if (!context) {
            return {
                text:
                    "I'm still waiting for the latest weather data to load.",
                topic:
                    info.topic
            };
        }

        const hours =
            context.hours;

        if (!hours.length) {
            return {
                text:
                    "I don't have enough hourly forecast data to compare that time period yet.",
                topic:
                    info.topic
            };
        }

        let candidates =
            hours.filter(h => {
                const hour =
                    getHour(
                        h.time
                    );

                if (
                    info.time ===
                    "morning"
                ) {
                    return (
                        hour >= 6 &&
                        hour < 12
                    );
                }

                if (
                    info.time ===
                    "afternoon"
                ) {
                    return (
                        hour >= 12 &&
                        hour < 17
                    );
                }

                if (
                    info.time ===
                    "evening"
                ) {
                    return (
                        hour >= 17 &&
                        hour < 22
                    );
                }

                if (
                    info.time ===
                    "tonight"
                ) {
                    return (
                        hour >= 20 ||
                        hour < 6
                    );
                }

                return true;
            });

        if (!candidates.length) {
            candidates = hours;
        }

        const best =
            findBestHour(
                candidates
            );

        if (!best) {
            return {
                text:
                    "I couldn't find a useful hourly forecast window.",
                topic:
                    info.topic
            };
        }

        const wettest =
            [...candidates].sort(
                (a, b) =>
                    (b.rain || 0) -
                    (a.rain || 0)
            )[0];

        const timeLabel =
            capitalize(
                info.time
            );

        let text =
            `For **${timeLabel.toLowerCase()}**, the forecast is around ` +
            `**${round(best.temp)}${context.unit}**, ` +
            `with a **${round(best.rain)}%** rain chance and ` +
            `wind around **${round(best.wind)} km/h**. `;

        if (
            wettest &&
            wettest.rain >= 50
        ) {
            text +=
                `The wetter point in this period is around **${clock(wettest.time)}**. `;
        }

        if (
            info.topic ===
            "rain"
        ) {
            text +=
                best.rain >= 50
                    ? "Rain is something I'd plan around during this period."
                    : "There isn't a strong rain signal during this period.";
        } else if (
            info.topic ===
            "temperature"
        ) {
            text +=
                comfortSentence(
                    best.feels ||
                    best.temp
                );
        } else if (
            info.topic ===
            "outdoor"
        ) {
            text +=
                outdoorSentence(
                    best
                );
        } else if (
            info.topic ===
            "clothing"
        ) {
            text +=
                clothingSentence(
                    best,
                    context
                );
        } else {
            text +=
                outdoorSentence(
                    best
                );
        }

        return {
            text,
            topic:
                info.topic,
            time:
                info.time
        };
    }

    /* ---------------------------------------------------------
       AI 3 UI
    --------------------------------------------------------- */

    function addSmartChrome() {
        const card =
            $("chatMessages")
                ?.closest(
                    ".ai-card"
                );

        if (
            !card ||
            card.dataset
                .ai3Chrome
        ) {
            return;
        }

        card.dataset.ai3Chrome =
            "true";

        const status =
            document.createElement(
                "div"
            );

        status.className =
            "ai3-context-bar";

        status.innerHTML = `
            <div class="ai3-status-left">
                <span class="ai3-dot"></span>

                <div>
                    <strong>
                        Smart Context
                    </strong>

                    <small id="ai3ContextText">
                        Ready to remember your conversation
                    </small>
                </div>
            </div>

            <button
                type="button"
                id="ai3ClearContext"
            >
                Clear memory
            </button>
        `;

        $("chatMessages")
            .before(status);

        $("ai3ClearContext")
            ?.addEventListener(
                "click",
                () => {
                    history = [];

                    saveContext();
                    updateContextLabel();

                    if (
                        typeof showToast ===
                        "function"
                    ) {
                        showToast(
                            "AI memory cleared"
                        );
                    }
                }
            );
    }

    function updateContextLabel() {
        const label =
            $("ai3ContextText");

        if (!label) {
            return;
        }

        const last =
            getLastContext();

        if (!last) {
            label.textContent =
                "Ready to remember your conversation";

            return;
        }

        const city =
            typeof currentCity !==
            "undefined"
                ? currentCity?.name
                : null;

        const parts = [];

        if (city) {
            parts.push(city);
        }

        if (
            last.timeReference
        ) {
            parts.push(
                last.timeReference
            );
        }

        if (
            last.topic &&
            last.topic !==
                "general"
        ) {
            parts.push(
                last.topic
            );
        }

        label.textContent =
            parts.length
                ? `Context: ${parts.join(" · ")}`
                : "Conversation context active";
    }

    function showSuggestions(
        topic,
        time
    ) {
        const card =
            $("chatMessages")
                ?.closest(
                    ".ai-card"
                );

        if (!card) {
            return;
        }

        const old =
            card.querySelector(
                ".ai3-suggestions"
            );

        old?.remove();

        const quick =
            getSuggestions(
                topic,
                time
            );

        if (!quick.length) {
            return;
        }

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "ai3-suggestions";

        wrapper.innerHTML = `
            <span class="ai3-suggestions-title">
                Continue the conversation
            </span>

            <div class="ai3-suggestion-list">
                ${quick
                    .map(
                        item =>
                            `<button type="button" data-ai3-question="${escapeAttr(item.question)}">${item.icon} ${escapeHTML(item.label)}</button>`
                    )
                    .join("")}
            </div>
        `;

        $("chatMessages")
            .after(wrapper);

        wrapper
            .querySelectorAll(
                "[data-ai3-question]"
            )
            .forEach(
                button => {
                    button.addEventListener(
                        "click",
                        () => {
                            const input =
                                $("chatInput");

                            if (!input) {
                                return;
                            }

                            input.value =
                                button.dataset
                                    .ai3Question;

                            input.focus();
                        }
                    );
                }
            );
    }

    function getSuggestions(
        topic,
        time
    ) {
        const prefix =
            time &&
            time !== "today"
                ? `${time} `
                : "";

        const map = {
            rain: [
                {
                    icon: "☔",
                    label:
                        "Umbrella?",
                    question:
                        `Will I need an umbrella ${prefix}today?`
                },
                {
                    icon: "🕐",
                    label:
                        "Rain timing",
                    question:
                        `When is rain most likely ${prefix}today?`
                },
                {
                    icon: "🏃",
                    label:
                        "Outdoor plans",
                    question:
                        `Is ${prefix}good for outdoor activities?`
                }
            ],

            temperature: [
                {
                    icon: "👕",
                    label:
                        "What to wear",
                    question:
                        `What should I wear ${prefix}today?`
                },
                {
                    icon: "🌡️",
                    label:
                        "Feels like",
                    question:
                        `What will it feel like ${prefix}today?`
                },
                {
                    icon: "🏃",
                    label:
                        "Go outside?",
                    question:
                        `Is ${prefix}good for going outside?`
                }
            ],

            outdoor: [
                {
                    icon: "🕐",
                    label:
                        "Best time",
                    question:
                        `What's the best time to go outside ${prefix}today?`
                },
                {
                    icon: "☔",
                    label:
                        "Rain risk",
                    question:
                        `What's the rain risk ${prefix}today?`
                },
                {
                    icon: "👕",
                    label:
                        "What to wear",
                    question:
                        `What should I wear ${prefix}today?`
                }
            ],

            clothing: [
                {
                    icon: "☔",
                    label:
                        "Rain?",
                    question:
                        `Will it rain ${prefix}today?`
                },
                {
                    icon: "🌡️",
                    label:
                        "Temperature",
                    question:
                        `What's the temperature ${prefix}today?`
                }
            ]
        };

        return (
            map[topic] || [
                {
                    icon: "🌧️",
                    label:
                        "Rain",
                    question:
                        `Will it rain ${prefix}today?`
                },
                {
                    icon: "🌡️",
                    label:
                        "Temperature",
                    question:
                        `What's the temperature ${prefix}today?`
                },
                {
                    icon: "🏃",
                    label:
                        "Outdoors",
                    question:
                        `Is ${prefix}good for outdoor activities?`
                }
            ]
        );
    }

    /* ---------------------------------------------------------
       MESSAGE HELPERS
       --------------------------------------------------------- */

    function addMessage(
        text,
        className
    ) {
        const container =
            $("chatMessages");

        if (!container) {
            return;
        }

        const div =
            document.createElement(
                "div"
            );

        div.className =
            className;

        if (
            className ===
            "bot-message"
        ) {
            div.innerHTML =
                formatText(
                    text
                );

            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "ai3-message-actions";

            actions.innerHTML = `
                <button
                    type="button"
                    data-ai3-copy
                >
                    Copy
                </button>
            `;

            actions
                .querySelector(
                    "[data-ai3-copy]"
                )
                ?.addEventListener(
                    "click",
                    () => {
                        navigator
                            .clipboard
                            ?.writeText(
                                stripHTML(
                                    text
                                )
                            );

                        if (
                            typeof showToast ===
                            "function"
                        ) {
                            showToast(
                                "Answer copied"
                            );
                        }
                    }
                );

            div.appendChild(
                actions
            );
        } else {
            div.textContent =
                text;
        }

        container.appendChild(
            div
        );

        container.scrollTop =
            container.scrollHeight;
    }

    function formatText(
        text
    ) {
        return String(text)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            )
            .replace(
                /\n/g,
                "<br>"
            );
    }

    function stripHTML(
        text
    ) {
        const div =
            document.createElement(
                "div"
            );

        div.innerHTML =
            text;

        return (
            div.textContent ||
            ""
        );
    }

    function escapeHTML(
        value
    ) {
        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    function escapeAttr(
        value
    ) {
        return escapeHTML(
            value
        );
    }

    /* ---------------------------------------------------------
       UTILITIES
    --------------------------------------------------------- */

    function normalize(
        text
    ) {
        return String(text)
            .toLowerCase()
            .replace(
                /[?!,.]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function num(
        value
    ) {
        const n =
            Number(value);

        return Number.isFinite(n)
            ? n
            : 0;
    }

    function round(
        value
    ) {
        return Math.round(
            num(value)
        );
    }

    function getHour(
        value
    ) {
        if (!value) {
            return -1;
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return -1;
        }

        return date.getHours();
    }

    function clock(
        value
    ) {
        if (!value) {
            return "—";
        }

        try {
            return new Date(
                value
            ).toLocaleTimeString(
                undefined,
                {
                    hour:
                        "numeric",
                    minute:
                        "2-digit"
                }
            );
        } catch {
            return value;
        }
    }

    function capitalize(
        value
    ) {
        return (
            String(value)
                .charAt(0)
                .toUpperCase() +
            String(value).slice(
                1
            )
        );
    }

    function currentLocationChanged() {
        updateContextLabel();
    }

    /* ---------------------------------------------------------
       PUBLIC AI3 API
    --------------------------------------------------------- */

    window.CloudoraAI3 = {
        clearMemory() {
            history = [];

            saveContext();
            updateContextLabel();
        },

        getContext() {
            return [
                ...history
            ];
        },

        remember(
            question,
            answer,
            meta = {}
        ) {
            remember(
                question,
                answer,
                meta
            );
        },

        refresh() {
            loadContext();
            updateContextLabel();
        },

        locationChanged:
            currentLocationChanged
    };

    /* ---------------------------------------------------------
       START AI 3.0
    --------------------------------------------------------- */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );
    } else {
        init();
    }

})();


/* ============================================================
   CLOUDORA AI 4.0 — LEGACY WEATHER REASONING COMPATIBILITY
   ------------------------------------------------------------
   AI 4.0 reasoning helpers are retained for compatibility.

   IMPORTANT:
   AI 4.0 DOES NOT intercept chat input.

   Cloudora AI 4.1 in ai-reasoning.js is the only answer
   authority.
   ============================================================ */

(() => {
    "use strict";

    const AI4_STORAGE =
        "cloudoraAI4Context";

    const AI4_MAX_MEMORY =
        16;

    let ai4Memory = [];

    const q$ =
        id =>
            document.getElementById(
                id
            );

    /* ---------------------------------------------------------
       INITIALIZATION
    --------------------------------------------------------- */

    function ai4Init() {
        loadAI4Memory();
        addAI4Chrome();

        /*
         * IMPORTANT:
         * Do NOT call installAI4FollowUps().
         *
         * AI 4.1 owns the actual answer generation.
         */

        console.log(
            "Cloudora AI 4.0 — Compatibility layer loaded."
        );
    }

    /* ---------------------------------------------------------
       MEMORY
    --------------------------------------------------------- */

    function loadAI4Memory() {
        try {
            const saved =
                JSON.parse(
                    localStorage.getItem(
                        AI4_STORAGE
                    ) || "[]"
                );

            ai4Memory =
                Array.isArray(
                    saved
                )
                    ? saved.slice(
                        -AI4_MAX_MEMORY
                    )
                    : [];
        } catch {
            ai4Memory = [];
        }
    }

    function saveAI4Memory() {
        try {
            localStorage.setItem(
                AI4_STORAGE,
                JSON.stringify(
                    ai4Memory.slice(
                        -AI4_MAX_MEMORY
                    )
                )
            );
        } catch {}
    }

    function rememberAI4(
        question,
        answer,
        meta = {}
    ) {
        ai4Memory.push({
            question:
                question || "",

            answer:
                stripAI4HTML(
                    answer || ""
                ),

            topic:
                meta.topic ||
                detectAI4Topic(
                    question
                ),

            time:
                meta.time ||
                detectAI4Time(
                    question
                ),

            timestamp:
                Date.now()
        });

        ai4Memory =
            ai4Memory.slice(
                -AI4_MAX_MEMORY
            );

        saveAI4Memory();
    }

    function lastAI4Memory() {
        return ai4Memory.length
            ? ai4Memory[
                ai4Memory.length - 1
            ]
            : null;
    }

    /* ---------------------------------------------------------
       NORMALIZATION
    --------------------------------------------------------- */

    function normalizeAI4(
        text
    ) {
        return String(
            text || ""
        )
            .toLowerCase()
            .replace(
                /[^\w\s?'-]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function stripAI4HTML(
        text
    ) {
        const div =
            document.createElement(
                "div"
            );

        div.innerHTML =
            text;

        return (
            div.textContent ||
            div.innerText ||
            ""
        );
    }

    /* ---------------------------------------------------------
       TOPIC DETECTION
    --------------------------------------------------------- */

    function detectAI4Topic(
        question
    ) {
        const text =
            normalizeAI4(
                question
            );

        if (
            /rain|rainy|raining|precipitation|umbrella/.test(
                text
            )
        ) {
            return "rain";
        }

        if (
            /temperature|temp|hot|cold|warm|cool|heat/.test(
                text
            )
        ) {
            return "temperature";
        }

        if (
            /wind|windy|gust/.test(
                text
            )
        ) {
            return "wind";
        }

        if (
            /humidity|humid|sticky/.test(
                text
            )
        ) {
            return "humidity";
        }

        if (
            /air quality|aqi|pollution|pm2/.test(
                text
            )
        ) {
            return "air";
        }

        if (
            /uv|sunburn|sunscreen|sun protection/.test(
                text
            )
        ) {
            return "uv";
        }

        if (
            /wear|clothes|outfit|jacket|shirt|clothing/.test(
                text
            )
        ) {
            return "clothing";
        }

        if (
            /outside|outdoor|walk|run|running|cycling|bike|hike|picnic|exercise|sport/.test(
                text
            )
        ) {
            return "outdoor";
        }

        if (
            /travel|trip|drive|driving|commute/.test(
                text
            )
        ) {
            return "travel";
        }

        if (
            /best time|when should|when can|when is/.test(
                text
            )
        ) {
            return "timing";
        }

        return "weather";
    }

    function detectAI4Time(
        question
    ) {
        const text =
            normalizeAI4(
                question
            );

        if (
            /day after tomorrow/.test(
                text
            )
        ) {
            return "day-after-tomorrow";
        }

        if (
            /tomorrow/.test(
                text
            )
        ) {
            return "tomorrow";
        }

        if (
            /tonight/.test(
                text
            )
        ) {
            return "tonight";
        }

        if (
            /evening/.test(
                text
            )
        ) {
            return "evening";
        }

        if (
            /afternoon/.test(
                text
            )
        ) {
            return "afternoon";
        }

        if (
            /morning/.test(
                text
            )
        ) {
            return "morning";
        }

        if (
            /today|now|currently|right now/.test(
                text
            )
        ) {
            return "today";
        }

        return null;
    }

    /* ---------------------------------------------------------
       WEATHER DATA
    --------------------------------------------------------- */

    function getAI4Weather() {
        if (
            typeof weatherData ===
                "undefined" ||
            !weatherData
        ) {
            return null;
        }

        return weatherData;
    }

    function getAI4Days() {
        const data =
            getAI4Weather();

        if (
            !data?.daily?.time
        ) {
            return [];
        }

        const d =
            data.daily;

        return d.time.map(
            (
                date,
                index
            ) => ({
                date,

                tempMax:
                    Number(
                        d.temperature_2m_max?.[
                            index
                        ] ??
                            NaN
                    ),

                tempMin:
                    Number(
                        d.temperature_2m_min?.[
                            index
                        ] ??
                            NaN
                    ),

                rain:
                    Number(
                        d.precipitation_probability_max?.[
                            index
                        ] ??
                            0
                    ),

                precipitation:
                    Number(
                        d.precipitation_sum?.[
                            index
                        ] ??
                            0
                    ),

                uv:
                    Number(
                        d.uv_index_max?.[
                            index
                        ] ??
                            0
                    ),

                wind:
                    Number(
                        d.wind_speed_10m_max?.[
                            index
                        ] ??
                            0
                    ),

                code:
                    Number(
                        d.weather_code?.[
                            index
                        ] ??
                            -1
                    )
            })
        );
    }

    function getAI4Hours() {
        const data =
            getAI4Weather();

        if (
            !data?.hourly?.time
        ) {
            return [];
        }

        const h =
            data.hourly;

        const start =
            typeof getCurrentHourlyIndex ===
            "function"
                ? getCurrentHourlyIndex()
                : 0;

        return h.time
            .slice(
                start,
                start + 48
            )
            .map(
                (
                    time,
                    localIndex
                ) => {
                    const i =
                        start +
                        localIndex;

                    return {
                        time,

                        temp:
                            Number(
                                h.temperature_2m?.[
                                    i
                                ] ??
                                    NaN
                            ),

                        feels:
                            Number(
                                h.apparent_temperature?.[
                                    i
                                ] ??
                                    NaN
                            ),

                        rain:
                            Number(
                                h.precipitation_probability?.[
                                    i
                                ] ??
                                    0
                            ),

                        precipitation:
                            Number(
                                h.precipitation?.[
                                    i
                                ] ??
                                    0
                            ),

                        wind:
                            Number(
                                h.wind_speed_10m?.[
                                    i
                                ] ??
                                    0
                            ),

                        uv:
                            Number(
                                h.uv_index?.[
                                    i
                                ] ??
                                    0
                            ),

                        humidity:
                            Number(
                                h.relative_humidity_2m?.[
                                    i
                                ] ??
                                    0
                            ),

                        code:
                            Number(
                                h.weather_code?.[
                                    i
                                ] ??
                                    -1
                            )
                    };
                }
            );
    }

    /* ---------------------------------------------------------
       SCORING
    --------------------------------------------------------- */

    function scoreHour(
        hour
    ) {
        if (!hour) {
            return Infinity;
        }

        let score = 0;

        score +=
            Math.min(
                hour.rain || 0,
                100
            ) * 0.65;

        if (
            hour.wind > 18
        ) {
            score +=
                (hour.wind - 18) *
                1.25;
        }

        if (
            hour.temp >= 34
        ) {
            score += 14;
        } else if (
            hour.temp >= 31
        ) {
            score += 6;
        }

        if (
            hour.temp < 12
        ) {
            score += 7;
        }

        if (
            hour.uv >= 8
        ) {
            score += 6;
        }

        if (
            hour.humidity >= 90
        ) {
            score += 5;
        }

        return score;
    }

    function scoreDay(
        day
    ) {
        if (!day) {
            return Infinity;
        }

        let score = 0;

        score +=
            Math.min(
                day.rain,
                100
            ) * 0.6;

        if (
            day.wind > 30
        ) {
            score +=
                (day.wind - 30) *
                1.2;
        }

        if (
            day.tempMax >= 36
        ) {
            score += 14;
        } else if (
            day.tempMax >= 33
        ) {
            score += 6;
        }

        if (
            day.tempMin < 12
        ) {
            score += 5;
        }

        if (
            day.uv >= 9
        ) {
            score += 5;
        }

        return score;
    }

    /* ---------------------------------------------------------
       DATE LABELS
    --------------------------------------------------------- */

    function ai4DayLabel(
        index
    ) {
        if (index === 0) {
            return "today";
        }

        if (index === 1) {
            return "tomorrow";
        }

        if (index === 2) {
            return "the day after tomorrow";
        }

        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];

        const date =
            getAI4Days()[
                index
            ]?.date;

        if (!date) {
            return `day ${
                index + 1
            }`;
        }

        const d =
            new Date(
                `${date}T12:00:00`
            );

        return days[
            d.getDay()
        ];
    }

    /* ---------------------------------------------------------
       TREND ANALYSIS
    --------------------------------------------------------- */

    function analyzeAI4Trend() {
        const days =
            getAI4Days();

        if (
            days.length < 2
        ) {
            return null;
        }

        const today =
            days[0];

        const tomorrow =
            days[1];

        return {
            tempChange:
                tomorrow.tempMax -
                today.tempMax,

            rainChange:
                tomorrow.rain -
                today.rain,

            windChange:
                tomorrow.wind -
                today.wind,

            uvChange:
                tomorrow.uv -
                today.uv
        };
    }

    /* ---------------------------------------------------------
       BEST DAY
    --------------------------------------------------------- */

    function findBestDay() {
        const days =
            getAI4Days();

        if (!days.length) {
            return null;
        }

        let bestIndex = 0;

        let bestScore =
            Infinity;

        days.forEach(
            (
                day,
                index
            ) => {
                const score =
                    scoreDay(
                        day
                    );

                if (
                    score <
                    bestScore
                ) {
                    bestScore =
                        score;

                    bestIndex =
                        index;
                }
            }
        );

        return {
            ...days[
                bestIndex
            ],

            index:
                bestIndex,

            label:
                ai4DayLabel(
                    bestIndex
                )
        };
    }

    /* ---------------------------------------------------------
       BEST TIME
    --------------------------------------------------------- */

    function findBestTime() {
        const hours =
            getAI4Hours();

        if (!hours.length) {
            return null;
        }

        const valid =
            hours.filter(
                hour =>
                    hour.rain < 60 &&
                    hour.wind < 35 &&
                    hour.temp < 35
            );

        const pool =
            valid.length
                ? valid
                : hours;

        return [...pool]
            .sort(
                (a, b) =>
                    scoreHour(a) -
                    scoreHour(b)
            )[0];
    }

    /* ---------------------------------------------------------
       RAIN WINDOW
    --------------------------------------------------------- */

    function findRainWindow() {
        const hours =
            getAI4Hours();

        if (!hours.length) {
            return null;
        }

        const rainy =
            hours.filter(
                h =>
                    h.rain >= 50
            );

        if (!rainy.length) {
            return {
                exists: false
            };
        }

        const highest =
            [...rainy].sort(
                (a, b) =>
                    b.rain -
                    a.rain
            )[0];

        return {
            exists: true,
            peak: highest
        };
    }

    /* ---------------------------------------------------------
       FORMAT TIME
    --------------------------------------------------------- */

    function formatAI4Time(
        time
    ) {
        if (!time) {
            return "then";
        }

        const date =
            new Date(time);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "then";
        }

        return date.toLocaleTimeString(
            [],
            {
                hour:
                    "numeric",
                minute:
                    "2-digit"
            }
        );
    }

    function formatAI4Temp(
        value
    ) {
        if (
            !Number.isFinite(
                value
            )
        ) {
            return "--";
        }

        const unit =
            typeof temperatureUnit !==
                "undefined" &&
            temperatureUnit ===
                "fahrenheit"
                ? "°F"
                : "°C";

        return `${Math.round(
            value
        )}${unit}`;
    }

    /* ---------------------------------------------------------
       NATURAL REASONING
       ---------------------------------------------------------
       Legacy helper functions retained for compatibility.
    --------------------------------------------------------- */

    function reasonOutdoor() {
        const best =
            findBestTime();

        if (!best) {
            return "I don't have enough forecast data to find a good outdoor window yet.";
        }

        const time =
            formatAI4Time(
                best.time
            );

        let answer =
            `The best outdoor window I can find is around **${time}**, ` +
            `with about **${Math.round(best.rain)}%** rain chance, ` +
            `**${formatAI4Temp(best.feels || best.temp)}** feels-like temperature ` +
            `and wind around **${Math.round(best.wind)} km/h**. `;

        if (
            best.uv >= 7
        ) {
            answer +=
                "UV is also fairly strong, so sun protection would help.";
        } else if (
            best.temp >= 34
        ) {
            answer +=
                "The heat is the main thing I'd plan around.";
        } else {
            answer +=
                "Those are among the more manageable conditions in the forecast.";
        }

        return answer;
    }

    function reasonRain() {
        const window =
            findRainWindow();

        if (
            !window?.exists
        ) {
            return "I don't see a strong rain signal in the next 48 hours based on the available forecast.";
        }

        return (
            `The strongest rain signal I can currently see is around ` +
            `**${formatAI4Time(window.peak.time)}**, with about ` +
            `**${Math.round(window.peak.rain)}%** rain probability.`
        );
    }

    function reasonTrend() {
        const trend =
            analyzeAI4Trend();

        if (!trend) {
            return "I need more forecast data before I can calculate a useful trend.";
        }

        const changes = [];

        if (
            Math.abs(
                trend.tempChange
            ) >= 2
        ) {
            changes.push(
                trend.tempChange >
                    0
                    ? `temperatures rise by about ${Math.abs(Math.round(trend.tempChange))}°`
                    : `temperatures fall by about ${Math.abs(Math.round(trend.tempChange))}°`
            );
        }

        if (
            Math.abs(
                trend.rainChange
            ) >= 15
        ) {
            changes.push(
                trend.rainChange >
                    0
                    ? "rain risk increases"
                    : "rain risk decreases"
            );
        }

        if (
            Math.abs(
                trend.windChange
            ) >= 8
        ) {
            changes.push(
                trend.windChange >
                    0
                    ? "winds become stronger"
                    : "winds ease"
            );
        }

        if (!changes.length) {
            return "Tomorrow looks broadly similar to today, without a major change in the main weather signals.";
        }

        return `Compared with today, tomorrow shows ${joinNatural(
            changes
        )}.`;
    }

    function reasonBestDay() {
        const best =
            findBestDay();

        if (!best) {
            return "I don't have enough daily forecast data to compare the days.";
        }

        return (
            `Among the available forecast days, **${best.label}** has the lowest ` +
            `combined weather-risk score, with a high around **${formatAI4Temp(best.tempMax)}**, ` +
            `rain probability near **${Math.round(best.rain)}%**, ` +
            `and maximum wind around **${Math.round(best.wind)} km/h**.`
        );
    }

    function reasonComparison() {
        const days =
            getAI4Days();

        if (
            days.length < 2
        ) {
            return "I don't have enough days loaded to make that comparison.";
        }

        const today =
            days[0];

        const tomorrow =
            days[1];

        const betterTomorrow =
            scoreDay(
                tomorrow
            ) <
            scoreDay(
                today
            );

        const tempDifference =
            Math.round(
                tomorrow.tempMax -
                today.tempMax
            );

        let answer =
            `Today has about **${Math.round(today.rain)}%** rain risk with a high near ` +
            `**${formatAI4Temp(today.tempMax)}**. Tomorrow is around ` +
            `**${Math.round(tomorrow.rain)}%** rain risk with a high near ` +
            `**${formatAI4Temp(tomorrow.tempMax)}**. `;

        if (
            betterTomorrow
        ) {
            answer +=
                "Overall, tomorrow's forecast signals are less restrictive.";
        } else {
            answer +=
                "Overall, today's forecast signals are less restrictive.";
        }

        if (
            Math.abs(
                tempDifference
            ) >= 2
        ) {
            answer +=
                tempDifference > 0
                    ? ` Tomorrow is roughly ${tempDifference}° warmer.`
                    : ` Tomorrow is roughly ${Math.abs(
                        tempDifference
                    )}° cooler.`;
        }

        return answer;
    }

    function joinNatural(
        items
    ) {
        if (
            items.length === 1
        ) {
            return items[0];
        }

        if (
            items.length === 2
        ) {
            return `${items[0]} and ${items[1]}`;
        }

        return `${items
            .slice(0, -1)
            .join(", ")}, and ${
            items[
                items.length - 1
            ]
        }`;
    }

    /* ---------------------------------------------------------
       FOLLOW-UP INTERPRETATION
       --------------------------------------------------------- */

    function interpretAI4(
        question
    ) {
        const text =
            normalizeAI4(
                question
            );

        const last =
            lastAI4Memory();

        if (
            /^why\b/.test(
                text
            )
        ) {
            return {
                type: "why",
                topic:
                    last?.topic ||
                    "weather"
            };
        }

        if (
            /best time|when should i|when can i|when is the best/.test(
                text
            )
        ) {
            return {
                type: "best-time",
                topic:
                    last?.topic ||
                    "outdoor"
            };
        }

        if (
            /best day|which day|what day is better|which day is better/.test(
                text
            )
        ) {
            return {
                type: "best-day"
            };
        }

        if (
            /trend|changing|change|getting hotter|getting colder|warming|cooling/.test(
                text
            )
        ) {
            return {
                type: "trend"
            };
        }

        if (
            /when will it rain|when is rain|rain timing|rain likely/.test(
                text
            )
        ) {
            return {
                type: "rain-window"
            };
        }

        if (
            /is that better|is tomorrow better|which is better|what about tomorrow/.test(
                text
            )
        ) {
            return {
                type: "comparison"
            };
        }

        if (
            /outdoor|outside|walk|run|running|cycling|exercise|picnic/.test(
                text
            )
        ) {
            return {
                type: "outdoor",
                topic:
                    "outdoor"
            };
        }

        if (
            /umbrella|rain|raining/.test(
                text
            )
        ) {
            return {
                type: "rain",
                topic:
                    "rain"
            };
        }

        return null;
    }

    /* ---------------------------------------------------------
       LEGACY ANSWER GENERATOR
       ---------------------------------------------------------
       This function is intentionally NOT connected to chat.
       AI 4.1 is the active answer engine.
    --------------------------------------------------------- */

    function answerAI4(
        question
    ) {
        const interpretation =
            interpretAI4(
                question
            );

        if (!interpretation) {
            return null;
        }

        let answer = "";

        switch (
            interpretation.type
        ) {
            case "best-time":
                answer =
                    reasonOutdoor();
                break;

            case "best-day":
                answer =
                    reasonBestDay();
                break;

            case "trend":
                answer =
                    reasonTrend();
                break;

            case "rain-window":
                answer =
                    reasonRain();
                break;

            case "comparison":
                answer =
                    reasonComparison();
                break;

            case "outdoor":
                answer =
                    reasonOutdoor();
                break;

            case "rain":
                answer =
                    reasonRain();
                break;

            case "why":
                answer =
                    explainLastDecision();
                break;

            default:
                answer = "";
        }

        if (!answer) {
            return null;
        }

        rememberAI4(
            question,
            answer,
            {
                topic:
                    interpretation.topic ||
                    "weather"
            }
        );

        return answer;
    }

    function explainLastDecision() {
        const last =
            lastAI4Memory();

        if (!last) {
            return "I don't have a previous recommendation to explain yet.";
        }

        const topic =
            last.topic;

        if (
            topic ===
            "outdoor"
        ) {
            return (
                "I based that recommendation mainly on rain probability, wind, " +
                "temperature/feels-like temperature, and UV. Rain and strong wind " +
                "are treated as bigger restrictions than small temperature differences."
            );
        }

        if (
            topic ===
            "rain"
        ) {
            return (
                "I mainly use precipitation probability and the hourly forecast " +
                "to identify when the rain signal is strongest."
            );
        }

        return (
            "I based the previous answer on the current forecast data, especially " +
            "temperature, rain probability, wind, UV, and the relevant hourly period."
        );
    }

    /* ---------------------------------------------------------
       AI 4 UI
    --------------------------------------------------------- */

    function addAI4Chrome() {
        const card =
            q$("chatMessages")
                ?.closest(
                    ".ai-card"
                );

        if (
            !card ||
            card.dataset
                .ai4Chrome
        ) {
            return;
        }

        card.dataset.ai4Chrome =
            "true";

        const bar =
            document.createElement(
                "div"
            );

        bar.className =
            "ai4-context-bar";

        bar.innerHTML = `
            <div>
                <strong>
                    Cloudora AI 4.1
                </strong>

                <small>
                    Advanced weather reasoning enabled
                </small>
            </div>

            <span class="ai4-status">
                ● Live forecast context
            </span>
        `;

        q$("chatMessages")
            .before(bar);
    }

    /* ---------------------------------------------------------
       PUBLIC AI4 COMPATIBILITY API
    --------------------------------------------------------- */

    window.CloudoraAI4 = {
        clearMemory() {
            ai4Memory = [];

            saveAI4Memory();
        },

        getMemory() {
            return [
                ...ai4Memory
            ];
        },

        refresh() {
            loadAI4Memory();
        },

        analyzeTrend:
            analyzeAI4Trend,

        findBestDay:
            findBestDay,

        findBestTime:
            findBestTime,

        findRainWindow:
            findRainWindow
    };

    /* ---------------------------------------------------------
       START AI 4.0 COMPATIBILITY LAYER
    --------------------------------------------------------- */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            ai4Init,
            {
                once: true
            }
        );
    } else {
        ai4Init();
    }

})();