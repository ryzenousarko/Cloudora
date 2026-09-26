/* ============================================================
   CLOUDORA AI ENGINE — UI CONTROLLER
   ------------------------------------------------------------
   AI 4.1 is the actual reasoning engine.
   This file only manages:
   - Chat UI
   - Send button
   - Enter key
   - Quick actions
   - Copy
   - Clear
   - Answer style UI
   - Loading state

   Actual weather reasoning:
   ai-reasoning.js
   ============================================================ */

(() => {
    "use strict";

    let aiBusy = false;
    let lastQuestion = "";
    let lastAnswer = "";

    const responseStyles = [
        "direct",
        "friendly",
        "detailed",
        "compact"
    ];

    let responseIndex = Number(
        localStorage.getItem("cloudoraAIResponseIndex") || 0
    );

    /* ============================================================
       HELPERS
       ============================================================ */

    const $ = id => document.getElementById(id);

    function getAI41() {
        if (
            typeof window !== "undefined" &&
            window.CloudoraAI41 &&
            typeof window.CloudoraAI41.answer === "function"
        ) {
            return window.CloudoraAI41;
        }

        return null;
    }

    /* ============================================================
       SETUP
       ============================================================ */

    function setup() {

        const card = $("chatMessages");
        const input = $("chatInput");
        const button = $("chatBtn");

        if (!card || !input || !button) {
            return;
        }

        /*
         * Clone the controls so older event listeners from
         * previous Cloudora AI versions are removed.
         */
        const freshInput = input.cloneNode(true);
        const freshButton = button.cloneNode(true);

        input.replaceWith(freshInput);
        button.replaceWith(freshButton);

        buildAIChrome();
        addWelcomeIfNeeded();

        /* --------------------------------------------------------
           SEND BUTTON
           -------------------------------------------------------- */

        freshButton.addEventListener("click", () => {
            send();
        });

        /* --------------------------------------------------------
           ENTER KEY
           -------------------------------------------------------- */

        freshInput.addEventListener("keydown", event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {
                event.preventDefault();
                send();
            }

        });

        /* --------------------------------------------------------
           QUICK ACTIONS
           -------------------------------------------------------- */

        document
            .querySelectorAll("[data-ai-question]")
            .forEach(button => {

                button.addEventListener("click", () => {

                    const input = $("chatInput");

                    if (!input) {
                        return;
                    }

                    input.value =
                        button.dataset.aiQuestion;

                    send();

                });

            });

    }

    /* ============================================================
       AI UI
       ============================================================ */

    function buildAIChrome() {

        const section =
            document
                .querySelector("#chatMessages")
                ?.closest(".ai-card");

        if (!section) {
            return;
        }

        if (section.dataset.aiEnhanced) {
            return;
        }

        section.dataset.aiEnhanced = "true";

        /* --------------------------------------------------------
           TITLE
           -------------------------------------------------------- */

        const title =
            section
                .closest(".section")
                ?.querySelector(".section-title h2");

        if (title) {
            title.textContent =
                "Cloudora Weather Intelligence";
        }

        const messages =
            $("chatMessages");

        const quick =
            section.querySelector(".quick-actions");

        const input =
            section.querySelector(".chat-input");

        /* --------------------------------------------------------
           INTELLIGENCE BAR
           -------------------------------------------------------- */

        const bar =
            document.createElement("div");

        bar.className =
            "ai-intelligence-bar";

        bar.innerHTML = `
            <div class="ai-status">
                <span class="ai-live-dot"></span>

                <div>
                    <strong>
                        Weather Intelligence
                    </strong>

                    <small id="aiContextLabel">
                        AI 4.1 • Live forecast reasoning
                    </small>
                </div>
            </div>

            <div class="ai-tools">

                <button
                    type="button"
                    class="ai-tool-btn"
                    id="aiClearBtn"
                >
                    Clear
                </button>

                <button
                    type="button"
                    class="ai-tool-btn"
                    id="aiStyleBtn"
                >
                    Answer style
                </button>

            </div>
        `;

        if (messages) {
            messages.before(bar);
        }

        /* --------------------------------------------------------
           QUICK ACTIONS
           -------------------------------------------------------- */

        if (quick) {

            quick.innerHTML = `
                <button
                    type="button"
                    data-ai-question="What should I know about the weather right now?"
                >
                    ✨ Weather brief
                </button>

                <button
                    type="button"
                    data-ai-question="Will I need an umbrella today?"
                >
                    ☔ Umbrella
                </button>

                <button
                    type="button"
                    data-ai-question="When is the best time to go outside today?"
                >
                    🌤️ Best time outside
                </button>

                <button
                    type="button"
                    data-ai-question="What should I wear today?"
                >
                    👕 What to wear
                </button>

                <button
                    type="button"
                    data-ai-question="Is today good for a run or walk?"
                >
                    🏃 Exercise
                </button>

                <button
                    type="button"
                    data-ai-question="How will the weather change over the next few hours?"
                >
                    📈 Next hours
                </button>

                <button
                    type="button"
                    data-ai-question="How is the air quality and what does it mean?"
                >
                    🌫️ Air quality
                </button>

                <button
                    type="button"
                    data-ai-question="What is the weather like tomorrow?"
                >
                    📅 Tomorrow
                </button>
            `;

            quick
                .querySelectorAll("button")
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const input =
                                $("chatInput");

                            if (!input) {
                                return;
                            }

                            input.value =
                                button.dataset.aiQuestion;

                            send();

                        }
                    );

                });

        }

        /* --------------------------------------------------------
           INPUT HINT
           -------------------------------------------------------- */

        if (input) {

            /*
             * Avoid adding the hint more than once.
             */
            if (
                !input.parentElement
                    ?.querySelector(".ai-input-hint")
            ) {

                const hint =
                    document.createElement("div");

                hint.className =
                    "ai-input-hint";

                hint.textContent =
                    "Ask naturally — Cloudora understands weather, timing, activities, clothing, rain, UV, wind, air quality and more.";

                input.before(hint);

            }

        }

        /* --------------------------------------------------------
           CLEAR BUTTON
           -------------------------------------------------------- */

        $("aiClearBtn")?.addEventListener(
            "click",
            () => {

                if (!messages) {
                    return;
                }

                messages.innerHTML = "";

                lastQuestion = "";
                lastAnswer = "";

                addBot(
                    "Chat cleared. Ask me anything about the current forecast."
                );

            }
        );

        /* --------------------------------------------------------
           ANSWER STYLE
           -------------------------------------------------------- */

        $("aiStyleBtn")?.addEventListener(
            "click",
            () => {

                responseIndex =
                    (
                        responseIndex + 1
                    ) %
                    responseStyles.length;

                localStorage.setItem(
                    "cloudoraAIResponseIndex",
                    responseIndex
                );

                const style =
                    responseStyles[
                        responseIndex
                    ];

                showToastLocal(
                    `Answer style: ${style}`
                );

            }
        );

    }

    /* ============================================================
       WELCOME MESSAGE
       ============================================================ */

    function addWelcomeIfNeeded() {

        const box =
            $("chatMessages");

        if (!box) {
            return;
        }

        if (
            !box.querySelector(".bot-message")
        ) {

            addBot(
                "Hi! I'm Cloudora Weather Intelligence. I use the live forecast for your selected city. Ask me things like “When should I go outside?”, “What should I wear today?”, “When is rain most likely?” or “Why?”"
            );

        }

    }

    /* ============================================================
       SEND
       ============================================================ */

    function send() {

        if (aiBusy) {
            return;
        }

        const input =
            $("chatInput");

        if (!input) {
            return;
        }

        const question =
            input.value.trim();

        if (!question) {
            return;
        }

        lastQuestion =
            question;

        addUser(question);

        input.value = "";

        setBusy(true);

        /*
         * Small delay makes the interface feel responsive
         * while keeping AI 4.1 responsible for the answer.
         */
        setTimeout(
            () => {

                try {

                    const ai =
                        getAI41();

                    if (!ai) {

                        throw new Error(
                            "Cloudora AI 4.1 is not available."
                        );

                    }

                    const result =
                        ai.answer(question);

                    let answer = "";

                    /*
                     * AI 4.1 normally returns a string.
                     *
                     * This also supports an object response
                     * in case the reasoning engine returns
                     * additional metadata.
                     */
                    if (
                        typeof result === "string"
                    ) {

                        answer =
                            result;

                    } else if (
                        result &&
                        typeof result.text === "string"
                    ) {

                        answer =
                            result.text;

                    } else {

                        answer =
                            String(result);

                    }

                    if (!answer.trim()) {

                        answer =
                            "I couldn't find enough information in the current forecast to answer that.";

                    }

                    lastAnswer =
                        answer;

                    addBot(answer);

                } catch (error) {

                    console.error(
                        "Cloudora AI 4.1:",
                        error
                    );

                    addBot(
                        "I couldn't calculate that from the current weather data. Try asking about temperature, rain, wind, UV, air quality, timing, activities, clothing or the forecast."
                    );

                } finally {

                    setBusy(false);

                }

            },
            220
        );

    }

    /* ============================================================
       LOADING STATE
       ============================================================ */

    function setBusy(value) {

        aiBusy =
            value;

        const button =
            $("chatBtn");

        if (button) {

            button.disabled =
                value;

            button.textContent =
                value
                    ? "Thinking…"
                    : "Send";

        }

        const input =
            $("chatInput");

        if (input) {

            input.setAttribute(
                "aria-busy",
                String(value)
            );

        }

    }

    /* ============================================================
       USER MESSAGE
       ============================================================ */

    function addUser(text) {

        appendMessage(
            escapeHTML(text),
            "user-message"
        );

    }

    /* ============================================================
       BOT MESSAGE
       ============================================================ */

    function addBot(text) {

        appendMessage(
            formatText(text),
            "bot-message"
        );

    }

    /* ============================================================
       MESSAGE RENDERER
       ============================================================ */

    function appendMessage(
        text,
        className
    ) {

        const container =
            $("chatMessages");

        if (!container) {
            return;
        }

        const div =
            document.createElement("div");

        div.className =
            className;

        div.innerHTML =
            text;

        /* --------------------------------------------------------
           BOT ACTIONS
           -------------------------------------------------------- */

        if (
            className === "bot-message"
        ) {

            const actions =
                document.createElement("div");

            actions.className =
                "ai-message-actions";

            actions.innerHTML = `
                <button
                    type="button"
                    data-copy
                >
                    Copy
                </button>

                <button
                    type="button"
                    data-again
                >
                    Another answer
                </button>
            `;

            /* ----------------------------------------------------
               COPY
               ---------------------------------------------------- */

            const copyButton =
                actions.querySelector(
                    "[data-copy]"
                );

            copyButton?.addEventListener(
                "click",
                () => {

                    navigator
                        .clipboard
                        ?.writeText(
                            stripHTML(text)
                        );

                    showToastLocal(
                        "Answer copied"
                    );

                }
            );

            /* ----------------------------------------------------
               ANOTHER ANSWER
               ---------------------------------------------------- */

            const againButton =
                actions.querySelector(
                    "[data-again]"
                );

            againButton?.addEventListener(
                "click",
                () => {

                    if (!lastQuestion) {
                        return;
                    }

                    generateAnotherAnswer();

                }
            );

            div.appendChild(
                actions
            );

        }

        container.appendChild(
            div
        );

        container.scrollTop =
            container.scrollHeight;

    }

    /* ============================================================
       ANOTHER ANSWER
       ============================================================ */

    function generateAnotherAnswer() {

        const ai =
            getAI41();

        if (!ai) {
            return;
        }

        try {

            /*
             * Ask AI 4.1 again using the original question.
             * If AI 4.1 supports refresh/reasoning state,
             * refresh it before answering.
             */
            if (
                typeof ai.refresh === "function"
            ) {
                try {
                    ai.refresh();
                } catch (_) {
                    /* Ignore refresh errors */
                }
            }

            const result =
                ai.answer(lastQuestion);

            let answer = "";

            if (
                typeof result === "string"
            ) {

                answer =
                    result;

            } else if (
                result &&
                typeof result.text === "string"
            ) {

                answer =
                    result.text;

            } else {

                answer =
                    String(result);

            }

            if (!answer.trim()) {
                return;
            }

            lastAnswer =
                answer;

            addBot(answer);

        } catch (error) {

            console.error(
                "Cloudora AI 4.1 alternate answer:",
                error
            );

            showToastLocal(
                "Couldn't generate another answer"
            );

        }

    }

    /* ============================================================
       FORMAT TEXT
       ============================================================ */

    function formatText(text) {

        return String(text)

            /*
             * Bold markdown
             */
            .replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            )

            /*
             * New lines
             */
            .replace(
                /\n/g,
                "<br>"
            );

    }

    /* ============================================================
       ESCAPE USER INPUT
       ============================================================ */

    function escapeHTML(text) {

        const div =
            document.createElement("div");

        div.textContent =
            String(text);

        return div.innerHTML;

    }

    /* ============================================================
       STRIP HTML
       ============================================================ */

    function stripHTML(text) {

        const div =
            document.createElement("div");

        div.innerHTML =
            String(text);

        return (
            div.textContent ||
            div.innerText ||
            ""
        );

    }

    /* ============================================================
       TOAST
       ============================================================ */

    function showToastLocal(message) {

        if (
            typeof showToast === "function"
        ) {

            showToast(message);

            return;

        }

        let toast =
            document.getElementById(
                "cloudoraAITost"
            );

        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );

            toast.id =
                "cloudoraAITost";

            toast.className =
                "cloudora-ai-toast";

            document.body.appendChild(
                toast
            );

        }

        toast.textContent =
            message;

        toast.classList.add(
            "show"
        );

        clearTimeout(
            toast._timer
        );

        toast._timer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                1800
            );

    }

    /* ============================================================
       INITIALIZE
       ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            setup,
            { once: true }
        );

    } else {

        setup();

    }

})();