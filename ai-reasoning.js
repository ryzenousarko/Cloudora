/* ============================================================
   CLOUDORA AI 4.3 — CONVERSATIONAL WEATHER INTELLIGENCE
   ------------------------------------------------------------
   Production reasoning layer for Cloudora.

   4.1 foundation:
   - Multi-factor weather analysis
   - Rain avoidance
   - Best / worst time detection
   - Activity recommendations
   - Running / walking safety logic
   - Rain-window analysis
   - Heat / cold analysis
   - Wind / UV / humidity analysis
   - Clothing recommendations
   - Today vs tomorrow comparisons
   - Weather-change questions
   - Air-quality awareness
   - "Why?" explanations

   4.2:
   - Multi-hour weather windows
   - Rain transition detection
   - Rain start / peak / easing / end
   - Recommendation confidence
   - Window scoring
   - Unit-aware reasoning
   - Adaptive explanations

   4.3:
   - Conversational context
   - Follow-up question understanding
   - Exact-time reasoning
   - Time-of-day reasoning
   - Morning / afternoon / evening / night detection
   - Better activity intent detection
   - Better rain-window reasoning
   - Decision risk levels
   - Factor-based explanations
   - Context-aware "why?"
   - Context-aware "what about tomorrow?"
   - Context-aware "what about 6 PM?"
   - More natural weather answers
   - CloudoraAI43 public API
   - CloudoraAI42 backward compatibility
   - CloudoraAI41 backward compatibility
   ============================================================ */

(() => {
    "use strict";

    const VERSION = "4.3";

    let lastDecision = null;

    /*
     * Conversation memory.
     *
     * This intentionally stays lightweight.
     * It remembers weather-related context rather than
     * storing an unlimited chat history.
     */
    let conversationContext = {
        lastQuestion: "",
        lastIntent: "",
        lastActivity: "",
        lastTime: null,
        lastTimeLabel: "",
        lastAnswerType: "",
        lastDecisionType: ""
    };

    /* ========================================================
       BASIC HELPERS
       ======================================================== */

    function number(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function round(value) {
        return Math.round(number(value));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalize(text) {
        return String(text || "")
            .toLowerCase()
            .replace(/[?!,.]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function temperatureUnit() {
        return typeof window.temperatureUnit !== "undefined" &&
            window.temperatureUnit === "fahrenheit"
            ? "°F"
            : "°C";
    }

    function getTemperatureUnit() {
        return temperatureUnit();
    }

    function getWeather() {
        return window.weatherData || null;
    }

    function formatTemp(value) {
        return `${round(value)}${getTemperatureUnit()}`;
    }

    function formatTime(value) {
        if (!value) {
            return "unknown time";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "unknown time";
        }

        return date.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function toCelsius(value) {
        /*
         * Open-Meteo's weather data is normally Celsius.
         * Keep calculations in Celsius and only convert
         * presentation through the existing Cloudora UI.
         */
        return number(value);
    }

    function displayTemperature(value) {
        return formatTemp(value);
    }

    /* ========================================================
       DATE / TIME HELPERS
       ======================================================== */

    function localDateKey(date = new Date()) {
        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function getForecastDateKey(value) {
        if (!value) {
            return "";
        }

        const text =
            String(value);

        /*
         * Open-Meteo hourly timestamps are normally
         * already formatted as local forecast time.
         */
        if (
            /^\d{4}-\d{2}-\d{2}/.test(text)
        ) {
            return text.slice(0, 10);
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return localDateKey(date);
    }

    function parseClockTime(text) {
        const normalized =
            normalize(text);

        /*
         * 6 PM / 6:30 PM / 18:30
         */
        const twelveHour =
            normalized.match(
                /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/
            );

        if (twelveHour) {
            let hour =
                Number(
                    twelveHour[1]
                );

            const minute =
                Number(
                    twelveHour[2] || 0
                );

            const meridiem =
                twelveHour[3];

            if (
                hour < 1 ||
                hour > 12 ||
                minute > 59
            ) {
                return null;
            }

            if (
                meridiem === "pm" &&
                hour !== 12
            ) {
                hour += 12;
            }

            if (
                meridiem === "am" &&
                hour === 12
            ) {
                hour = 0;
            }

            return {
                hour,
                minute,
                label:
                    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
            };
        }

        /*
         * 18:30
         */
        const twentyFour =
            normalized.match(
                /\b([01]?\d|2[0-3]):([0-5]\d)\b/
            );

        if (twentyFour) {
            const hour =
                Number(
                    twentyFour[1]
                );

            const minute =
                Number(
                    twentyFour[2]
                );

            return {
                hour,
                minute,
                label:
                    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
            };
        }

        /*
         * Natural time phrases.
         */
        if (
            /\bmidnight\b/.test(
                normalized
            )
        ) {
            return {
                hour: 0,
                minute: 0,
                label: "00:00"
            };
        }

        if (
            /\bnoon\b/.test(
                normalized
            )
        ) {
            return {
                hour: 12,
                minute: 0,
                label: "12:00"
            };
        }

        return null;
    }

    function detectTimeOfDay(text) {
        const normalized =
            normalize(text);

        if (
            /\b(morning|early morning|sunrise)\b/.test(
                normalized
            )
        ) {
            return "morning";
        }

        if (
            /\b(afternoon|midday)\b/.test(
                normalized
            )
        ) {
            return "afternoon";
        }

        if (
            /\b(evening|sunset)\b/.test(
                normalized
            )
        ) {
            return "evening";
        }

        if (
            /\b(night|tonight|late night)\b/.test(
                normalized
            )
        ) {
            return "night";
        }

        return null;
    }

    function timeOfDayRange(period) {
        switch (period) {
            case "morning":
                return {
                    start: 5,
                    end: 11
                };

            case "afternoon":
                return {
                    start: 12,
                    end: 16
                };

            case "evening":
                return {
                    start: 17,
                    end: 20
                };

            case "night":
                return {
                    start: 21,
                    end: 23
                };

            default:
                return null;
        }
    }

    function hourMatchesPeriod(
        hour,
        period
    ) {
        if (
            !hour?.time ||
            !period
        ) {
            return false;
        }

        const date =
            new Date(hour.time);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return false;
        }

        const range =
            timeOfDayRange(
                period
            );

        if (!range) {
            return false;
        }

        const h =
            date.getHours();

        return (
            h >= range.start &&
            h <= range.end
        );
    }

    /* ========================================================
       WEATHER DATA
       ======================================================== */

    function createHourlyObject(
        data,
        i
    ) {
        return {
            index: i,

            time:
                data?.hourly?.time?.[i],

            temp:
                number(
                    data?.hourly
                        ?.temperature_2m?.[i]
                ),

            feels:
                number(
                    data?.hourly
                        ?.apparent_temperature?.[i]
                ),

            rainChance:
                number(
                    data?.hourly
                        ?.precipitation_probability?.[i]
                ),

            precipitation:
                number(
                    data?.hourly
                        ?.precipitation?.[i]
                ),

            wind:
                number(
                    data?.hourly
                        ?.wind_speed_10m?.[i]
                ),

            humidity:
                number(
                    data?.hourly
                        ?.relative_humidity_2m?.[i]
                ),

            uv:
                number(
                    data?.hourly
                        ?.uv_index?.[i]
                ),

            code:
                number(
                    data?.hourly
                        ?.weather_code?.[i]
                )
        };
    }

    function getHourlyData(
        startIndex = null,
        count = 24
    ) {
        const data =
            getWeather();

        if (
            !data ||
            !data.hourly
        ) {
            return [];
        }

        let index =
            startIndex;

        if (
            index === null &&
            typeof window.getCurrentHourlyIndex ===
                "function"
        ) {
            index =
                window.getCurrentHourlyIndex();
        }

        if (
            !Number.isFinite(index)
        ) {
            index = 0;
        }

        const hourly =
            data.hourly;

        const total =
            hourly.time?.length ||
            0;

        const end =
            Math.min(
                index + count,
                total
            );

        const result = [];

        for (
            let i = index;
            i < end;
            i++
        ) {
            result.push(
                createHourlyObject(
                    data,
                    i
                )
            );
        }

        return result;
    }

    function getFutureHours(
        daysAhead = 0
    ) {
        const data =
            getWeather();

        if (
            !data?.hourly?.time
        ) {
            return [];
        }

        const target =
            new Date();

        target.setDate(
            target.getDate() +
            daysAhead
        );

        /*
         * IMPORTANT:
         * Do not use toISOString() here.
         * It can shift the date because of UTC conversion.
         */
        const targetDate =
            localDateKey(
                target
            );

        const result = [];

        for (
            let i = 0;
            i < data.hourly.time.length;
            i++
        ) {
            const time =
                data.hourly.time[i];

            if (
                getForecastDateKey(
                    time
                ) !== targetDate
            ) {
                continue;
            }

            result.push(
                createHourlyObject(
                    data,
                    i
                )
            );
        }

        return result;
    }

    /* ========================================================
       WEATHER CODE INTELLIGENCE
       ======================================================== */

    function weatherCodeInfo(
        code
    ) {
        const value =
            number(code);

        if (
            value === 0
        ) {
            return {
                label: "clear sky",
                category: "clear",
                severity: 0
            };
        }

        if (
            value === 1 ||
            value === 2
        ) {
            return {
                label: "partly cloudy",
                category: "cloud",
                severity: 1
            };
        }

        if (
            value === 3
        ) {
            return {
                label: "overcast",
                category: "cloud",
                severity: 1
            };
        }

        if (
            [45, 48].includes(value)
        ) {
            return {
                label: "foggy",
                category: "visibility",
                severity: 2
            };
        }

        if (
            [51, 53, 55].includes(value)
        ) {
            return {
                label: "drizzle",
                category: "rain",
                severity: 2
            };
        }

        if (
            [56, 57].includes(value)
        ) {
            return {
                label: "freezing drizzle",
                category: "rain",
                severity: 3
            };
        }

        if (
            [61, 63, 65].includes(value)
        ) {
            return {
                label: "rain",
                category: "rain",
                severity:
                    value === 65
                        ? 4
                        : 3
            };
        }

        if (
            [66, 67].includes(value)
        ) {
            return {
                label: "freezing rain",
                category: "rain",
                severity: 4
            };
        }

        if (
            [71, 73, 75, 77].includes(value)
        ) {
            return {
                label: "snow",
                category: "snow",
                severity: 4
            };
        }

        if (
            [80, 81, 82].includes(value)
        ) {
            return {
                label: "rain showers",
                category: "rain",
                severity:
                    value === 82
                        ? 4
                        : 3
            };
        }

        if (
            [85, 86].includes(value)
        ) {
            return {
                label: "snow showers",
                category: "snow",
                severity: 4
            };
        }

        if (
            [95, 96, 99].includes(value)
        ) {
            return {
                label: "thunderstorm",
                category: "storm",
                severity: 5
            };
        }

        return {
            label: "mixed conditions",
            category: "mixed",
            severity: 1
        };
    }

    /* ========================================================
       WEATHER CONDITION HELPERS
       ======================================================== */

    function isRainy(hour) {
        if (!hour) {
            return false;
        }

        return (
            number(
                hour.rainChance
            ) >= 60 ||
            number(
                hour.precipitation
            ) >= 0.5 ||
            [
                51,
                53,
                55,
                56,
                57,
                61,
                63,
                65,
                66,
                67,
                80,
                81,
                82
            ].includes(
                number(hour.code)
            )
        );
    }

    function isHeavyRain(hour) {
        if (!hour) {
            return false;
        }

        return (
            number(
                hour.rainChance
            ) >= 80 ||
            number(
                hour.precipitation
            ) >= 2 ||
            [
                63,
                65,
                67,
                81,
                82
            ].includes(
                number(hour.code)
            )
        );
    }

    function isStorm(hour) {
        if (!hour) {
            return false;
        }

        return [
            95,
            96,
            99
        ].includes(
            number(hour.code)
        );
    }

    /* ========================================================
       WEATHER SEVERITY
       ======================================================== */

    function rainScore(hour) {
        const rain =
            number(
                hour?.rainChance
            );

        if (rain >= 90) return 55;
        if (rain >= 80) return 48;
        if (rain >= 70) return 40;
        if (rain >= 60) return 32;
        if (rain >= 45) return 22;
        if (rain >= 30) return 12;
        if (rain >= 20) return 5;

        return 0;
    }

    function precipitationScore(hour) {
        const precipitation =
            number(
                hour?.precipitation
            );

        if (precipitation >= 5) return 35;
        if (precipitation >= 2) return 25;
        if (precipitation >= 1) return 18;
        if (precipitation >= 0.5) return 10;

        return 0;
    }

    function windScore(hour) {
        const wind =
            number(
                hour?.wind
            );

        if (wind >= 50) return 35;
        if (wind >= 40) return 28;
        if (wind >= 35) return 22;
        if (wind >= 30) return 15;
        if (wind >= 25) return 10;
        if (wind >= 18) return 4;

        return 0;
    }

    function heatScore(hour) {
        const temp =
            toCelsius(
                hour?.feels ||
                hour?.temp
            );

        if (temp >= 42) return 45;
        if (temp >= 38) return 35;
        if (temp >= 35) return 28;
        if (temp >= 33) return 20;
        if (temp >= 30) return 10;

        return 0;
    }

    function coldScore(hour) {
        const temp =
            toCelsius(
                hour?.feels ||
                hour?.temp
            );

        if (temp <= 5) return 35;
        if (temp <= 10) return 25;
        if (temp <= 15) return 15;
        if (temp <= 18) return 7;

        return 0;
    }

    function uvScore(hour) {
        const uv =
            number(
                hour?.uv
            );

        if (uv >= 11) return 30;
        if (uv >= 8) return 22;
        if (uv >= 6) return 14;
        if (uv >= 3) return 6;

        return 0;
    }

    function humidityScore(hour) {
        const humidity =
            number(
                hour?.humidity
            );

        if (humidity >= 95) return 25;
        if (humidity >= 90) return 20;
        if (humidity >= 80) return 12;
        if (humidity >= 70) return 7;

        return 0;
    }

    /* ========================================================
       FACTOR ANALYSIS 4.3
       ======================================================== */

    function getWeatherFactors(
        hour
    ) {
        if (!hour) {
            return [];
        }

        const factors = [];

        const rain =
            number(
                hour.rainChance
            );

        const precipitation =
            number(
                hour.precipitation
            );

        const wind =
            number(
                hour.wind
            );

        const feels =
            toCelsius(
                hour.feels ||
                hour.temp
            );

        const uv =
            number(
                hour.uv
            );

        const humidity =
            number(
                hour.humidity
            );

        if (
            isStorm(hour)
        ) {
            factors.push({
                type: "storm",
                severity: "critical",
                score: 50,
                message:
                    "thunderstorm risk is present"
            });
        }

        if (
            rain >= 80 ||
            isHeavyRain(hour)
        ) {
            factors.push({
                type: "rain",
                severity: "high",
                score:
                    rainScore(hour),
                message:
                    `${round(rain)}% rain risk`
            });
        } else if (
            rain >= 40
        ) {
            factors.push({
                type: "rain",
                severity: "moderate",
                score:
                    rainScore(hour),
                message:
                    `${round(rain)}% rain risk`
            });
        }

        if (
            precipitation >= 2
        ) {
            factors.push({
                type: "precipitation",
                severity: "high",
                score:
                    precipitationScore(hour),
                message:
                    `${precipitation.toFixed(1)} mm precipitation expected`
            });
        }

        if (
            wind >= 30
        ) {
            factors.push({
                type: "wind",
                severity: "high",
                score:
                    windScore(hour),
                message:
                    `wind around ${round(wind)} km/h`
            });
        } else if (
            wind >= 20
        ) {
            factors.push({
                type: "wind",
                severity: "moderate",
                score:
                    windScore(hour),
                message:
                    `moderate wind around ${round(wind)} km/h`
            });
        }

        if (
            feels >= 35
        ) {
            factors.push({
                type: "heat",
                severity: "high",
                score:
                    heatScore(hour),
                message:
                    `feels like ${formatTemp(feels)}`
            });
        } else if (
            feels >= 30
        ) {
            factors.push({
                type: "heat",
                severity: "moderate",
                score:
                    heatScore(hour),
                message:
                    `warm conditions around ${formatTemp(feels)}`
            });
        }

        if (
            feels <= 10
        ) {
            factors.push({
                type: "cold",
                severity: "moderate",
                score:
                    coldScore(hour),
                message:
                    `feels like ${formatTemp(feels)}`
            });
        }

        if (
            uv >= 8
        ) {
            factors.push({
                type: "uv",
                severity: "high",
                score:
                    uvScore(hour),
                message:
                    `UV around ${round(uv)}`
            });
        } else if (
            uv >= 6
        ) {
            factors.push({
                type: "uv",
                severity: "moderate",
                score:
                    uvScore(hour),
                message:
                    `UV around ${round(uv)}`
            });
        }

        if (
            humidity >= 90
        ) {
            factors.push({
                type: "humidity",
                severity: "high",
                score:
                    humidityScore(hour),
                message:
                    `humidity around ${round(humidity)}%`
            });
        } else if (
            humidity >= 80
        ) {
            factors.push({
                type: "humidity",
                severity: "moderate",
                score:
                    humidityScore(hour),
                message:
                    `humidity around ${round(humidity)}%`
            });
        }

        return factors;
    }

    function classifyRisk(
        score,
        hour = null
    ) {
        if (
            isStorm(hour)
        ) {
            return {
                level: "unfavorable",
                label: "avoid",
                score
            };
        }

        if (
            score >= 80
        ) {
            return {
                level: "favorable",
                label: "good",
                score
            };
        }

        if (
            score >= 65
        ) {
            return {
                level: "favorable",
                label: "generally good",
                score
            };
        }

        if (
            score >= 50
        ) {
            return {
                level: "caution",
                label: "mixed",
                score
            };
        }

        if (
            score >= 35
        ) {
            return {
                level: "unfavorable",
                label: "not ideal",
                score
            };
        }

        return {
            level: "unfavorable",
            label: "avoid",
            score
        };
    }

    /* ========================================================
       GENERAL COMFORT
       ======================================================== */

    function comfortScore(hour) {
        if (!hour) {
            return 0;
        }

        const penalties =
            rainScore(hour) +
            precipitationScore(hour) +
            windScore(hour) +
            heatScore(hour) +
            coldScore(hour) +
            uvScore(hour) +
            humidityScore(hour);

        let score =
            100 - penalties;

        if (
            isStorm(hour)
        ) {
            score -= 40;
        }

        return clamp(
            score,
            0,
            100
        );
    }

    function outdoorScore(hour) {
        if (!hour) {
            return 0;
        }

        let score =
            comfortScore(hour);

        const rain =
            number(
                hour.rainChance
            );

        if (
            rain >= 90
        ) {
            score -= 45;
        } else if (
            rain >= 80
        ) {
            score -= 35;
        } else if (
            rain >= 70
        ) {
            score -= 28;
        } else if (
            rain >= 60
        ) {
            score -= 20;
        }

        if (
            isHeavyRain(hour)
        ) {
            score -= 20;
        }

        if (
            isStorm(hour)
        ) {
            score -= 50;
        }

        return clamp(
            score,
            0,
            100
        );
    }

    /* ========================================================
       BEST / WORST HOURS
       ======================================================== */

    function findBestHour(
        hours
    ) {
        if (
            !hours.length
        ) {
            return null;
        }

        return [...hours]
            .map(
                hour => ({
                    ...hour,
                    score:
                        outdoorScore(
                            hour
                        )
                })
            )
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            )[0];
    }

    function findWorstHour(
        hours
    ) {
        if (
            !hours.length
        ) {
            return null;
        }

        return [...hours]
            .map(
                hour => ({
                    ...hour,
                    score:
                        outdoorScore(
                            hour
                        )
                })
            )
            .sort(
                (a, b) =>
                    a.score -
                    b.score
            )[0];
    }

    /* ========================================================
       TIME-SPECIFIC FORECAST SELECTION
       ======================================================== */

    function findHourByClock(
        hours,
        clock
    ) {
        if (
            !hours.length ||
            !clock
        ) {
            return null;
        }

        return [...hours]
            .map(
                hour => {
                    const date =
                        new Date(
                            hour.time
                        );

                    if (
                        Number.isNaN(
                            date.getTime()
                        )
                    ) {
                        return {
                            hour,
                            difference:
                                Infinity
                        };
                    }

                    const hourMinutes =
                        date.getHours() *
                            60 +
                        date.getMinutes();

                    const targetMinutes =
                        clock.hour *
                            60 +
                        clock.minute;

                    return {
                        hour,
                        difference:
                            Math.abs(
                                hourMinutes -
                                targetMinutes
                            )
                    };
                }
            )
            .sort(
                (a, b) =>
                    a.difference -
                    b.difference
            )[0]?.hour || null;
    }

    function findHoursByPeriod(
        hours,
        period
    ) {
        if (
            !period
        ) {
            return hours;
        }

        const filtered =
            hours.filter(
                hour =>
                    hourMatchesPeriod(
                        hour,
                        period
                    )
            );

        return filtered.length
            ? filtered
            : hours;
    }

    function getRequestedTimeContext(
        question
    ) {
        const clock =
            parseClockTime(
                question
            );

        const period =
            detectTimeOfDay(
                question
            );

        return {
            clock,
            period
        };
    }

    /* ========================================================
       RAIN ANALYSIS
       ======================================================== */

    function findRainWindow(
        hours
    ) {
        if (
            !hours.length
        ) {
            return null;
        }

        const rainy =
            hours.filter(
                hour =>
                    number(
                        hour.rainChance
                    ) >= 40 ||
                    number(
                        hour.precipitation
                    ) >= 0.5 ||
                    isRainy(hour)
            );

        if (
            !rainy.length
        ) {
            return {
                exists: false,
                hours: []
            };
        }

        const strongest =
            [...rainy].sort(
                (a, b) => {

                    const aScore =
                        number(
                            a.rainChance
                        ) +
                        number(
                            a.precipitation
                        ) *
                            10;

                    const bScore =
                        number(
                            b.rainChance
                        ) +
                        number(
                            b.precipitation
                        ) *
                            10;

                    return (
                        bScore -
                        aScore
                    );
                }
            )[0];

        return {
            exists: true,
            hours: rainy,
            strongest
        };
    }

    /* ========================================================
       MULTI-HOUR WINDOW SCORING
       ======================================================== */

    function scoreWeatherWindow(
        hours,
        windowSize = 2
    ) {
        if (
            !Array.isArray(hours) ||
            !hours.length
        ) {
            return [];
        }

        const size =
            Math.max(
                1,
                Math.min(
                    Number(
                        windowSize
                    ) || 2,
                    hours.length
                )
            );

        const windows = [];

        for (
            let i = 0;
            i <=
            hours.length - size;
            i++
        ) {
            const slice =
                hours.slice(
                    i,
                    i + size
                );

            const scores =
                slice.map(
                    hour =>
                        outdoorScore(
                            hour
                        )
                );

            const averageScore =
                scores.reduce(
                    (sum, score) =>
                        sum + score,
                    0
                ) /
                scores.length;

            const rainValues =
                slice.map(
                    hour =>
                        number(
                            hour.rainChance
                        )
                );

            const windValues =
                slice.map(
                    hour =>
                        number(
                            hour.wind
                        )
                );

            const precipitationValues =
                slice.map(
                    hour =>
                        number(
                            hour.precipitation
                        )
                );

            const averageRain =
                rainValues.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                rainValues.length;

            const averageWind =
                windValues.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                windValues.length;

            const totalPrecipitation =
                precipitationValues.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );

            const worstRain =
                Math.max(
                    ...rainValues
                );

            const worstScore =
                Math.min(
                    ...scores
                );

            let stabilityPenalty = 0;

            if (
                worstScore <
                averageScore - 30
            ) {
                stabilityPenalty += 10;
            }

            if (
                worstRain >= 70
            ) {
                stabilityPenalty += 15;
            }

            if (
                slice.some(
                    hour =>
                        isStorm(hour)
                )
            ) {
                stabilityPenalty += 30;
            }

            const windowScore =
                clamp(
                    averageScore -
                        stabilityPenalty,
                    0,
                    100
                );

            windows.push({
                start:
                    slice[0],

                end:
                    slice[
                        slice.length - 1
                    ],

                hours:
                    slice,

                score:
                    windowScore,

                averageScore,

                worstScore,

                averageRain,

                worstRain,

                averageWind,

                totalPrecipitation
            });
        }

        return windows.sort(
            (a, b) =>
                b.score -
                a.score
        );
    }

    function findBestWeatherWindow(
        hours,
        windowSize = 2
    ) {
        const windows =
            scoreWeatherWindow(
                hours,
                windowSize
            );

        return (
            windows.length
                ? windows[0]
                : null
        );
    }

    /* ========================================================
       RAIN TRANSITIONS
       ======================================================== */

    function analyzeRainTransitions(
        hours
    ) {
        if (
            !Array.isArray(hours) ||
            !hours.length
        ) {
            return {
                exists: false,
                start: null,
                peak: null,
                easing: null,
                end: null,
                rainyHours: []
            };
        }

        const rainyHours =
            hours.filter(
                hour =>
                    number(
                        hour.rainChance
                    ) >= 40 ||
                    number(
                        hour.precipitation
                    ) >= 0.5 ||
                    isRainy(hour)
            );

        if (
            !rainyHours.length
        ) {
            return {
                exists: false,
                start: null,
                peak: null,
                easing: null,
                end: null,
                rainyHours: []
            };
        }

        const strongest =
            [...rainyHours].sort(
                (a, b) => {

                    const aScore =
                        number(
                            a.rainChance
                        ) +
                        number(
                            a.precipitation
                        ) *
                            10;

                    const bScore =
                        number(
                            b.rainChance
                        ) +
                        number(
                            b.precipitation
                        ) *
                            10;

                    return (
                        bScore -
                        aScore
                    );
                }
            )[0];

        const peakIndex =
            hours.findIndex(
                hour =>
                    hour.index ===
                    strongest.index
            );

        const start =
            rainyHours[0];

        let easing = null;
        let end = null;

        if (
            peakIndex >= 0
        ) {
            for (
                let i =
                    peakIndex + 1;
                i < hours.length;
                i++
            ) {
                const current =
                    hours[i];

                const previous =
                    hours[i - 1];

                if (
                    number(
                        current.rainChance
                    ) <
                        number(
                            previous.rainChance
                        ) &&
                    !easing
                ) {
                    easing =
                        current;
                }

                if (
                    number(
                        current.rainChance
                    ) < 30 &&
                    number(
                        current.precipitation
                    ) < 0.5 &&
                    !isRainy(current)
                ) {
                    end =
                        current;

                    break;
                }
            }
        }

        return {
            exists: true,
            start,
            peak: strongest,
            easing,
            end,
            rainyHours
        };
    }

    /* ========================================================
       CONFIDENCE
       ======================================================== */

    function calculateRecommendationConfidence(
        window
    ) {
        if (
            !window
        ) {
            return {
                level: "low",
                score: 0
            };
        }

        let confidence = 50;

        if (
            window.score >= 80
        ) {
            confidence += 25;
        } else if (
            window.score >= 65
        ) {
            confidence += 15;
        } else if (
            window.score >= 50
        ) {
            confidence += 5;
        }

        if (
            window.worstRain <= 20
        ) {
            confidence += 10;
        } else if (
            window.worstRain >= 60
        ) {
            confidence -= 15;
        }

        if (
            window.worstScore >= 70
        ) {
            confidence += 10;
        } else if (
            window.worstScore < 45
        ) {
            confidence -= 15;
        }

        confidence =
            clamp(
                confidence,
                0,
                100
            );

        let level =
            "moderate";

        if (
            confidence >= 80
        ) {
            level = "high";
        } else if (
            confidence < 55
        ) {
            level = "low";
        }

        return {
            level,
            score: confidence
        };
    }

    function formatWeatherWindow(
        window
    ) {
        if (!window) {
            return "an uncertain period";
        }

        const start =
            formatTime(
                window.start?.time
            );

        const end =
            formatTime(
                window.end?.time
            );

        return `${start}–${end}`;
    }

    function explainWeatherWindow(
        window
    ) {
        if (!window) {
            return "";
        }

        const confidence =
            calculateRecommendationConfidence(
                window
            );

        const reasons = [];

        if (
            window.averageRain <= 20
        ) {
            reasons.push(
                "low rain risk"
            );
        } else if (
            window.averageRain <= 40
        ) {
            reasons.push(
                "manageable rain risk"
            );
        } else {
            reasons.push(
                "elevated rain risk"
            );
        }

        if (
            window.averageWind <= 15
        ) {
            reasons.push(
                "light winds"
            );
        } else if (
            window.averageWind <= 25
        ) {
            reasons.push(
                "moderate winds"
            );
        } else {
            reasons.push(
                "stronger winds"
            );
        }

        if (
            window.worstScore >= 70
        ) {
            reasons.push(
                "consistent outdoor comfort"
            );
        }

        return (
            `The window is supported by ${reasons.join(", ")}. ` +
            `Confidence is **${confidence.level}**.`
        );
    }

    /* ========================================================
       ACTIVITY PROFILES
       ======================================================== */

    function activityProfile(
        activity
    ) {
        const text =
            normalize(activity);

        if (
            /run|running|jog/.test(
                text
            )
        ) {
            return {
                name: "running",
                rainLimit: 35,
                windLimit: 25,
                heatLimit: 31,
                uvLimit: 7,
                humidityLimit: 80,
                minScore: 65
            };
        }

        if (
            /cycle|cycling|bike|biking/.test(
                text
            )
        ) {
            return {
                name: "cycling",
                rainLimit: 30,
                windLimit: 25,
                heatLimit: 32,
                uvLimit: 7,
                humidityLimit: 80,
                minScore: 65
            };
        }

        if (
            /walk|walking|stroll/.test(
                text
            )
        ) {
            return {
                name: "walking",
                rainLimit: 45,
                windLimit: 32,
                heatLimit: 34,
                uvLimit: 8,
                humidityLimit: 88,
                minScore: 60
            };
        }

        if (
            /picnic|park/.test(
                text
            )
        ) {
            return {
                name: "a picnic",
                rainLimit: 25,
                windLimit: 25,
                heatLimit: 32,
                uvLimit: 7,
                humidityLimit: 82,
                minScore: 65
            };
        }

        if (
            /sport|football|soccer|cricket|badminton|tennis/.test(
                text
            )
        ) {
            return {
                name: "outdoor sports",
                rainLimit: 30,
                windLimit: 28,
                heatLimit: 32,
                uvLimit: 7,
                humidityLimit: 82,
                minScore: 65
            };
        }

        if (
            /drive|driving|commute|travel/.test(
                text
            )
        ) {
            return {
                name: "travel",
                rainLimit: 70,
                windLimit: 45,
                heatLimit: 38,
                uvLimit: 12,
                humidityLimit: 95,
                minScore: 50
            };
        }

        return {
            name: "outdoor activity",
            rainLimit: 40,
            windLimit: 30,
            heatLimit: 34,
            uvLimit: 9,
            humidityLimit: 85,
            minScore: 60
        };
    }

    function extractActivity(
        question
    ) {
        const text =
            normalize(question);

        if (
            /run|running|jog/.test(
                text
            )
        ) {
            return "running";
        }

        if (
            /cycle|cycling|bike|biking/.test(
                text
            )
        ) {
            return "cycling";
        }

        if (
            /walk|walking|stroll/.test(
                text
            )
        ) {
            return "walking";
        }

        if (
            /picnic|park/.test(
                text
            )
        ) {
            return "picnic";
        }

        if (
            /sport|football|soccer|cricket|badminton|tennis/.test(
                text
            )
        ) {
            return "outdoor sports";
        }

        if (
            /drive|driving|commute|travel/.test(
                text
            )
        ) {
            return "travel";
        }

        return (
            conversationContext.lastActivity ||
            "outdoor activity"
        );
    }

    /* ========================================================
       ACTIVITY REASONING
       ======================================================== */

    function analyzeActivity(
        hours,
        activity
    ) {
        if (
            !hours.length
        ) {
            return null;
        }

        const profile =
            activityProfile(
                activity
            );

        const scored =
            hours.map(
                hour => {

                    let score = 100;

                    const rain =
                        number(
                            hour.rainChance
                        );

                    const precipitation =
                        number(
                            hour.precipitation
                        );

                    const wind =
                        number(
                            hour.wind
                        );

                    const feels =
                        toCelsius(
                            hour.feels ||
                            hour.temp
                        );

                    const uv =
                        number(
                            hour.uv
                        );

                    const humidity =
                        number(
                            hour.humidity
                        );

                    if (
                        rain >= 90
                    ) {
                        score -= 70;
                    } else if (
                        rain >= 80
                    ) {
                        score -= 60;
                    } else if (
                        rain >= 70
                    ) {
                        score -= 45;
                    } else if (
                        rain >
                        profile.rainLimit
                    ) {
                        score -= 35;
                    } else if (
                        rain >= 20
                    ) {
                        score -= 10;
                    }

                    if (
                        precipitation >= 5
                    ) {
                        score -= 35;
                    } else if (
                        precipitation >= 2
                    ) {
                        score -= 25;
                    } else if (
                        precipitation >= 1
                    ) {
                        score -= 15;
                    } else if (
                        precipitation >= 0.5
                    ) {
                        score -= 8;
                    }

                    if (
                        wind >= 45
                    ) {
                        score -= 35;
                    } else if (
                        wind >
                        profile.windLimit
                    ) {
                        score -= 25;
                    }

                    if (
                        feels >=
                        profile.heatLimit + 5
                    ) {
                        score -= 30;
                    } else if (
                        feels >
                        profile.heatLimit
                    ) {
                        score -= 20;
                    }

                    if (
                        feels <= 8
                    ) {
                        score -= 20;
                    }

                    if (
                        uv >
                        profile.uvLimit
                    ) {
                        score -= 15;
                    }

                    if (
                        humidity >= 95
                    ) {
                        score -= 25;
                    } else if (
                        humidity >
                        profile.humidityLimit
                    ) {
                        score -= 18;
                    } else if (
                        humidity >= 80
                    ) {
                        score -= 8;
                    }

                    if (
                        isStorm(hour)
                    ) {
                        score -= 50;
                    }

                    return {
                        ...hour,
                        score:
                            clamp(
                                score,
                                0,
                                100
                            )
                    };
                }
            );

        scored.sort(
            (a, b) =>
                b.score -
                a.score
        );

        const best =
            scored[0];

        const acceptable =
            scored.filter(
                hour =>
                    hour.score >=
                        profile.minScore &&
                    number(
                        hour.rainChance
                    ) <=
                        profile.rainLimit &&
                    number(
                        hour.wind
                    ) <=
                        profile.windLimit &&
                    !isStorm(hour)
            );

        return {
            profile,
            best,
            acceptableBest:
                acceptable.length
                    ? acceptable[0]
                    : null,
            worst:
                scored[
                    scored.length - 1
                ]
        };
    }

    function explainActivityHour(
        hour,
        profile
    ) {
        if (
            !hour ||
            !profile
        ) {
            return "";
        }

        const reasons = [];

        const rain =
            number(
                hour.rainChance
            );

        const wind =
            number(
                hour.wind
            );

        const feels =
            toCelsius(
                hour.feels ||
                hour.temp
            );

        const humidity =
            number(
                hour.humidity
            );

        const uv =
            number(
                hour.uv
            );

        if (
            rain <= 20
        ) {
            reasons.push(
                "low rain risk"
            );
        } else if (
            rain <=
            profile.rainLimit
        ) {
            reasons.push(
                "manageable rain risk"
            );
        }

        if (
            wind <=
            profile.windLimit
        ) {
            reasons.push(
                "manageable wind"
            );
        }

        if (
            feels >= 18 &&
            feels <=
                profile.heatLimit
        ) {
            reasons.push(
                "a reasonable temperature"
            );
        }

        if (
            humidity <=
            profile.humidityLimit
        ) {
            reasons.push(
                "acceptable humidity"
            );
        }

        if (
            uv <=
            profile.uvLimit
        ) {
            reasons.push(
                "manageable UV"
            );
        }

        if (
            !reasons.length
        ) {
            return "";
        }

        return (
            `The main positives are ${reasons.join(", ")}.`
        );
    }

    /* ========================================================
       TEMPERATURE
       ======================================================== */

    function temperatureSummary(
        hour
    ) {
        if (!hour) {
            return (
                "I don't have enough temperature data yet."
            );
        }

        const temp =
            toCelsius(
                hour.feels ||
                hour.temp
            );

        if (
            temp >= 38
        ) {
            return (
                "It will feel very hot, so heat exposure is the main concern."
            );
        }

        if (
            temp >= 34
        ) {
            return (
                "It will feel hot, especially under direct sunlight."
            );
        }

        if (
            temp >= 30
        ) {
            return (
                "It will feel warm, with heat becoming more noticeable outdoors."
            );
        }

        if (
            temp >= 24
        ) {
            return (
                "The temperature is generally comfortable for many activities."
            );
        }

        if (
            temp >= 18
        ) {
            return (
                "The temperature should feel mild and fairly comfortable."
            );
        }

        if (
            temp >= 10
        ) {
            return (
                "It will feel cool, especially during longer outdoor periods."
            );
        }

        return (
            "It will feel cold, so warmer clothing is advisable."
        );
    }

    /* ========================================================
       CLOTHING
       ======================================================== */

    function clothingAdvice(
        hour
    ) {
        if (!hour) {
            return (
                "I don't have enough weather data for a clothing recommendation."
            );
        }

        const temp =
            toCelsius(
                hour.feels ||
                hour.temp
            );

        const rain =
            number(
                hour.rainChance
            );

        const wind =
            number(
                hour.wind
            );

        const humidity =
            number(
                hour.humidity
            );

        const uv =
            number(
                hour.uv
            );

        const advice = [];

        if (
            temp >= 36
        ) {
            advice.push(
                "very light, breathable clothing"
            );
        } else if (
            temp >= 30
        ) {
            advice.push(
                "light, breathable clothing"
            );
        } else if (
            temp >= 25
        ) {
            advice.push(
                "a light outfit"
            );
        } else if (
            temp >= 18
        ) {
            advice.push(
                "a light extra layer"
            );
        } else if (
            temp >= 10
        ) {
            advice.push(
                "a warmer layer"
            );
        } else {
            advice.push(
                "warm layers"
            );
        }

        if (
            rain >= 50
        ) {
            advice.push(
                "rain protection"
            );
        }

        if (
            wind >= 30
        ) {
            advice.push(
                "a wind-resistant outer layer"
            );
        }

        if (
            uv >= 7
        ) {
            advice.push(
                "sun protection"
            );
        }

        if (
            humidity >= 90
        ) {
            advice.push(
                "lightweight fabric because humidity is high"
            );
        }

        return (
            `I'd suggest ${advice.join(", ")}.`
        );
    }

    /* ========================================================
       EXPLANATION ENGINE
       ======================================================== */

    function explainHour(
        hour
    ) {
        if (!hour) {
            return (
                "I don't have enough forecast data to explain that recommendation."
            );
        }

        const reasons = [];

        const rain =
            number(
                hour.rainChance
            );

        const precipitation =
            number(
                hour.precipitation
            );

        const wind =
            number(
                hour.wind
            );

        const feels =
            toCelsius(
                hour.feels ||
                hour.temp
            );

        const uv =
            number(
                hour.uv
            );

        const humidity =
            number(
                hour.humidity
            );

        if (
            rain >= 50
        ) {
            reasons.push(
                `${round(rain)}% rain chance`
            );
        }

        if (
            precipitation >= 0.5
        ) {
            reasons.push(
                `${precipitation.toFixed(1)} mm expected precipitation`
            );
        }

        if (
            wind >= 25
        ) {
            reasons.push(
                `wind around ${round(wind)} km/h`
            );
        }

        if (
            feels >= 32
        ) {
            reasons.push(
                `feels like ${formatTemp(feels)}`
            );
        }

        if (
            uv >= 7
        ) {
            reasons.push(
                `UV around ${round(uv)}`
            );
        }

        if (
            humidity >= 80
        ) {
            reasons.push(
                `humidity around ${round(humidity)}%`
            );
        }

        if (
            isStorm(hour)
        ) {
            reasons.push(
                "thunderstorm risk"
            );
        }

        if (
            !reasons.length
        ) {
            return (
                "The forecast looks relatively balanced, without a major weather factor working against it."
            );
        }

        return (
            `I chose it because the forecast has ${reasons.join(", ")}.`
        );
    }

    function explainDecision(
        hour
    ) {
        if (!hour) {
            return "";
        }

        const score =
            outdoorScore(
                hour
            );

        const risk =
            classifyRisk(
                score,
                hour
            );

        const factors =
            getWeatherFactors(
                hour
            );

        if (
            !factors.length
        ) {
            return (
                `Overall outdoor conditions look **${risk.label}**, with a score around **${round(score)}/100**.`
            );
        }

        const factorText =
            factors
                .slice(0, 3)
                .map(
                    factor =>
                        factor.message
                )
                .join(", ");

        return (
            `Overall conditions look **${risk.label}** at around **${round(score)}/100**. ` +
            `The main factors are ${factorText}.`
        );
    }

    /* ========================================================
       DAY SUMMARY
       ======================================================== */

    function summarizeDay(
        hours
    ) {
        if (
            !hours.length
        ) {
            return null;
        }

        const temperatures =
            hours.map(
                h =>
                    toCelsius(
                        h.feels ||
                        h.temp
                    )
            );

        const rain =
            Math.max(
                ...hours.map(
                    h =>
                        number(
                            h.rainChance
                        )
                )
            );

        const avgWind =
            hours.reduce(
                (sum, h) =>
                    sum +
                    number(
                        h.wind
                    ),
                0
            ) /
            hours.length;

        const best =
            findBestHour(
                hours
            );

        const window =
            findBestWeatherWindow(
                hours,
                2
            );

        const rainAnalysis =
            analyzeRainTransitions(
                hours
            );

        return {
            high:
                Math.max(
                    ...temperatures
                ),

            low:
                Math.min(
                    ...temperatures
                ),

            rainChance:
                rain,

            avgWind,

            best,

            bestWindow:
                window,

            rainAnalysis
        };
    }

    /* ========================================================
       INTENT DETECTION 4.3
       ======================================================== */

    function detectIntent(
        question
    ) {
        const text =
            normalize(question);

        /*
         * Explicit follow-up reasoning.
         */
        if (
            /^(why|why not|how come|what do you mean)$/.test(
                text
            )
        ) {
            return "why";
        }

        /*
         * Comparison should be detected before
         * individual today/tomorrow intents.
         */
        if (
            /today.*tomorrow|tomorrow.*today|compare|comparison|which.*better/.test(
                text
            )
        ) {
            return "comparison";
        }

        if (
            /air quality|air pollution|pollution|aqi/.test(
                text
            )
        ) {
            return "air-quality";
        }

        if (
            /clothing|outfit|wear|jacket|umbrella/.test(
                text
            )
        ) {
            /*
             * Umbrella questions are more useful as
             * rain questions unless actual clothing
             * is being discussed.
             */
            if (
                /umbrella/.test(
                    text
                ) &&
                !/wear|outfit|clothing|jacket/.test(
                    text
                )
            ) {
                return "rain";
            }

            return "clothing";
        }

        /*
         * Exact-time requests should be detected
         * before generic activity intent.
         */
        const hasClock =
            !!parseClockTime(
                text
            );

        const hasPeriod =
            !!detectTimeOfDay(
                text
            );

        if (
            hasClock ||
            hasPeriod
        ) {
            if (
                /rain|raining|weather|outside|outdoor|walk|walking|run|running|jog|cycle|cycling|bike|travel|drive|sport|picnic|good|safe|okay|ok|should i|can i/.test(
                    text
                )
            ) {
                return "time-specific";
            }
        }

        if (
            /why/.test(
                text
            )
        ) {
            return "why";
        }

        if (
            /tomorrow/.test(
                text
            )
        ) {
            return "tomorrow";
        }

        if (
            /next few hours|next few hour|weather change|how will.*change|changing|change over/.test(
                text
            )
        ) {
            return "change";
        }

        if (
            /best time|good time|ideal time|when should i|when is the best|best window/.test(
                text
            )
        ) {
            return "best-time";
        }

        if (
            /worst time|bad time|avoid/.test(
                text
            )
        ) {
            return "worst-time";
        }

        if (
            /rain.*when|when.*rain|rain timing|rain likely|when will.*rain|rain stop|rain end|when does.*rain/.test(
                text
            )
        ) {
            return "rain-timing";
        }

        if (
            /run|running|jog|cycle|cycling|bike|walking|walk|stroll|picnic|travel|drive|commute|sport|football|soccer|cricket|badminton|tennis/.test(
                text
            )
        ) {
            return "activity";
        }

        if (
            /temperature|temp|hot|cold|heat|feels like/.test(
                text
            )
        ) {
            return "temperature";
        }

        if (
            /wind|windy/.test(
                text
            )
        ) {
            return "wind";
        }

        if (
            /humidity|humid/.test(
                text
            )
        ) {
            return "humidity";
        }

        if (
            /\buv\b|sun/.test(
                text
            )
        ) {
            return "uv";
        }

        if (
            /rain|raining/.test(
                text
            )
        ) {
            return "rain";
        }

        if (
            /outside|outdoor|go out|should i go|can i go/.test(
                text
            )
        ) {
            return "outdoor";
        }

        return "general";
    }

    /* ========================================================
       CONVERSATION CONTEXT
       ======================================================== */

    function updateConversationContext(
        question,
        intent,
        options = {}
    ) {
        conversationContext.lastQuestion =
            String(
                question || ""
            );

        conversationContext.lastIntent =
            intent || "";

        if (
            options.activity
        ) {
            conversationContext.lastActivity =
                options.activity;
        }

        if (
            options.clock
        ) {
            conversationContext.lastTime =
                options.clock;

            conversationContext.lastTimeLabel =
                options.clock.label ||
                "";
        }

        if (
            options.answerType
        ) {
            conversationContext.lastAnswerType =
                options.answerType;
        }

        if (
            options.decisionType
        ) {
            conversationContext.lastDecisionType =
                options.decisionType;
        }
    }

    function isContextOnlyFollowUp(
        question
    ) {
        const text =
            normalize(question);

        return (
            /^(why|why not|what about|and at|how about|what if|then what|is that|would that|okay but|ok but)/.test(
                text
            )
        );
    }

    /* ========================================================
       ANSWER: BEST TIME
       ======================================================== */

    function answerBestTime(
        question = ""
    ) {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I'm still waiting for enough hourly forecast data to determine the best time."
            );
        }

        const requested =
            getRequestedTimeContext(
                question
            );

        let searchHours =
            hours;

        if (
            requested.period
        ) {
            searchHours =
                findHoursByPeriod(
                    hours,
                    requested.period
                );
        }

        const best =
            findBestHour(
                searchHours
            );

        if (!best) {
            return (
                "I couldn't identify a reliable best period from the available forecast."
            );
        }

        const score =
            outdoorScore(
                best
            );

        const risk =
            classifyRisk(
                score,
                best
            );

        lastDecision = {
            type: "best-time",
            hour: best,
            score,
            risk,
            reasons:
                getWeatherFactors(
                    best
                )
        };

        updateConversationContext(
            question,
            "best-time",
            {
                answerType:
                    "best-time",
                decisionType:
                    "best-time"
            }
        );

        if (
            score < 45 ||
            best.rainChance >= 70 ||
            isHeavyRain(best) ||
            isStorm(best)
        ) {
            return (
                `There isn't a genuinely good outdoor window in the selected period. ` +
                `The least-unfavorable time is around **${formatTime(best.time)}**, ` +
                `but it still has a **${round(best.rainChance)}%** rain chance. ` +
                `${explainDecision(best)}`
            );
        }

        return (
            `The best outdoor period looks like **${formatTime(best.time)}**. ` +
            `It should feel around **${formatTemp(best.feels || best.temp)}**, ` +
            `with a **${round(best.rainChance)}%** rain chance and ` +
            `wind around **${round(best.wind)} km/h**. ` +
            `${explainDecision(best)}`
        );
    }

    function answerBestTime43(
        question = ""
    ) {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return answerBestTime(
                question
            );
        }

        const requested =
            getRequestedTimeContext(
                question
            );

        let searchHours =
            hours;

        if (
            requested.period
        ) {
            searchHours =
                findHoursByPeriod(
                    hours,
                    requested.period
                );
        }

        const window =
            findBestWeatherWindow(
                searchHours,
                2
            );

        if (!window) {
            return answerBestTime(
                question
            );
        }

        const confidence =
            calculateRecommendationConfidence(
                window
            );

        lastDecision = {
            type:
                "best-time-4.3",
            hour:
                window.start,
            window,
            confidence,
            risk:
                classifyRisk(
                    window.score,
                    window.start
                ),
            reasons:
                getWeatherFactors(
                    window.start
                )
        };

        updateConversationContext(
            question,
            "best-time",
            {
                answerType:
                    "best-time-window",
                decisionType:
                    "best-time-4.3"
            }
        );

        if (
            window.score < 45 ||
            window.worstRain >= 70
        ) {
            return (
                `I don't see a genuinely good outdoor window in the selected period. ` +
                `The least-unfavorable period is around **${formatWeatherWindow(window)}**. ` +
                `${explainWeatherWindow(window)}`
            );
        }

        return (
            `The best **2-hour outdoor window** looks like **${formatWeatherWindow(window)}**. ` +
            `Conditions average around **${round(window.averageScore)}/100**, ` +
            `with rain risk averaging **${round(window.averageRain)}%**. ` +
            `${explainWeatherWindow(window)}`
        );
    }

    /* ========================================================
       ANSWER: EXACT TIME
       ======================================================== */

    function answerTimeSpecific(
        question
    ) {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I need the hourly forecast before I can check that specific time."
            );
        }

        const requested =
            getRequestedTimeContext(
                question
            );

        let target = null;

        if (
            requested.clock
        ) {
            target =
                findHourByClock(
                    hours,
                    requested.clock
                );
        } else if (
            requested.period
        ) {
            const periodHours =
                findHoursByPeriod(
                    hours,
                    requested.period
                );

            target =
                findBestHour(
                    periodHours
                );
        }

        if (!target) {
            return (
                "I couldn't match that time to the available hourly forecast."
            );
        }

        const activity =
            extractActivity(
                question
            );

        const hasActivity =
            /run|running|jog|walk|walking|cycle|cycling|bike|picnic|travel|drive|sport|football|soccer|cricket|badminton|tennis/.test(
                normalize(question)
            ) ||
            conversationContext.lastActivity;

        if (
            hasActivity
        ) {
            const analysis =
                analyzeActivity(
                    hours,
                    activity
                );

            const activityHour =
                analysis
                    ? findHourByClock(
                        hours,
                        requested.clock
                    ) || target
                    : target;

            const profile =
                analysis?.profile ||
                activityProfile(
                    activity
                );

            let activityScore =
                100;

            const rain =
                number(
                    activityHour.rainChance
                );

            const wind =
                number(
                    activityHour.wind
                );

            const feels =
                toCelsius(
                    activityHour.feels ||
                    activityHour.temp
                );

            const humidity =
                number(
                    activityHour.humidity
                );

            const uv =
                number(
                    activityHour.uv
                );

            if (
                rain >= 90
            ) {
                activityScore -= 70;
            } else if (
                rain >= 80
            ) {
                activityScore -= 60;
            } else if (
                rain >= 70
            ) {
                activityScore -= 45;
            } else if (
                rain >
                profile.rainLimit
            ) {
                activityScore -= 35;
            } else if (
                rain >= 20
            ) {
                activityScore -= 10;
            }

            if (
                number(
                    activityHour.precipitation
                ) >= 2
            ) {
                activityScore -= 25;
            }

            if (
                wind >
                profile.windLimit
            ) {
                activityScore -= 25;
            }

            if (
                feels >
                profile.heatLimit
            ) {
                activityScore -= 20;
            }

            if (
                feels <= 8
            ) {
                activityScore -= 20;
            }

            if (
                uv >
                profile.uvLimit
            ) {
                activityScore -= 15;
            }

            if (
                humidity >
                profile.humidityLimit
            ) {
                activityScore -= 18;
            }

            if (
                isStorm(
                    activityHour
                )
            ) {
                activityScore -= 50;
            }

            activityScore =
                clamp(
                    activityScore,
                    0,
                    100
                );

            const suitable =
                activityScore >=
                    profile.minScore &&
                rain <=
                    profile.rainLimit &&
                wind <=
                    profile.windLimit &&
                !isStorm(
                    activityHour
                );

            lastDecision = {
                type:
                    "time-specific-activity",
                hour:
                    activityHour,
                activity,
                score:
                    activityScore,
                suitable,
                reasons:
                    getWeatherFactors(
                        activityHour
                    )
            };

            updateConversationContext(
                question,
                "time-specific",
                {
                    activity,
                    clock:
                        requested.clock,
                    answerType:
                        "time-specific-activity",
                    decisionType:
                        "time-specific-activity"
                }
            );

            const timeLabel =
                formatTime(
                    activityHour.time
                );

            if (
                suitable
            ) {
                return (
                    `Yes — **${timeLabel}** looks reasonably suitable for **${profile.name}**. ` +
                    `It feels like **${formatTemp(activityHour.feels || activityHour.temp)}**, ` +
                    `rain chance is **${round(activityHour.rainChance)}%**, ` +
                    `and wind is around **${round(activityHour.wind)} km/h**. ` +
                    `${explainActivityHour(activityHour, profile)}`
                );
            }

            return (
                `I'd be cautious about **${profile.name}** at **${timeLabel}**. ` +
                `It feels like **${formatTemp(activityHour.feels || activityHour.temp)}**, ` +
                `with a **${round(activityHour.rainChance)}%** rain chance and ` +
                `wind around **${round(activityHour.wind)} km/h**. ` +
                `${explainDecision(activityHour)}`
            );
        }

        const score =
            outdoorScore(
                target
            );

        const risk =
            classifyRisk(
                score,
                target
            );

        lastDecision = {
            type:
                "time-specific",
            hour:
                target,
            score,
            risk,
            reasons:
                getWeatherFactors(
                    target
                )
        };

        updateConversationContext(
            question,
            "time-specific",
            {
                clock:
                    requested.clock,
                answerType:
                    "time-specific",
                decisionType:
                    "time-specific"
            }
        );

        return (
            `Around **${formatTime(target.time)}**, it should feel like **${formatTemp(target.feels || target.temp)}**, ` +
            `with a **${round(target.rainChance)}%** rain chance and ` +
            `wind around **${round(target.wind)} km/h**. ` +
            `${explainDecision(target)}`
        );
    }

    /* ========================================================
       ANSWER: WORST TIME
       ======================================================== */

    function answerWorstTime() {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I don't have enough hourly data to identify the worst period."
            );
        }

        const worst =
            findWorstHour(
                hours
            );

        if (!worst) {
            return (
                "I couldn't identify a clearly unfavorable period."
            );
        }

        lastDecision = {
            type: "worst-time",
            hour: worst,
            score:
                outdoorScore(
                    worst
                ),
            reasons:
                getWeatherFactors(
                    worst
                )
        };

        updateConversationContext(
            "",
            "worst-time",
            {
                answerType:
                    "worst-time",
                decisionType:
                    "worst-time"
            }
        );

        return (
            `I'd be most cautious around **${formatTime(worst.time)}**. ` +
            `Conditions are around **${formatTemp(worst.feels || worst.temp)}**, ` +
            `with a **${round(worst.rainChance)}%** rain chance and ` +
            `wind around **${round(worst.wind)} km/h**. ` +
            `${explainDecision(worst)}`
        );
    }

    /* ========================================================
       ANSWER: RAIN
       ======================================================== */

    function answerRainTiming() {
        const hours =
            getHourlyData();

        const analysis =
            analyzeRainTransitions(
                hours
            );

        if (
            !analysis.exists
        ) {
            return (
                "I don't see a strong rain period in the available forecast."
            );
        }

        const peak =
            analysis.peak;

        lastDecision = {
            type:
                "rain-4.3",
            hour:
                peak,
            rainAnalysis:
                analysis,
            reasons:
                getWeatherFactors(
                    peak
                )
        };

        updateConversationContext(
            "",
            "rain-timing",
            {
                answerType:
                    "rain-timing",
                decisionType:
                    "rain-4.3"
            }
        );

        let response =
            `The strongest rain signal is around **${formatTime(peak.time)}**, ` +
            `with about **${round(peak.rainChance)}%** rain chance.`;

        if (
            analysis.start &&
            analysis.start.index !==
                peak.index
        ) {
            response +=
                ` Rain appears to build from around **${formatTime(analysis.start.time)}**.`;
        }

        if (
            analysis.easing
        ) {
            response +=
                ` It starts easing around **${formatTime(analysis.easing.time)}**.`;
        }

        if (
            analysis.end
        ) {
            response +=
                ` The forecast returns to a lower-rain period around **${formatTime(analysis.end.time)}**.`;
        } else {
            response +=
                ` The available forecast does not show a clearly dry endpoint yet.`;
        }

        return response;
    }

    /* ========================================================
       ANSWER: ACTIVITY
       ======================================================== */

    function answerActivity(
        question
    ) {
        const hours =
            getHourlyData();

        const activity =
            extractActivity(
                question
            );

        const analysis =
            analyzeActivity(
                hours,
                activity
            );

        if (!analysis) {
            return (
                "I need the hourly forecast before I can analyze that activity."
            );
        }

        const profile =
            analysis.profile;

        const best =
            analysis.acceptableBest;

        if (!best) {
            const fallback =
                analysis.best;

            lastDecision = {
                type:
                    "activity",
                hour:
                    fallback,
                activity:
                    profile.name,
                unsuitable:
                    true,
                reasons:
                    getWeatherFactors(
                        fallback
                    )
            };

            updateConversationContext(
                question,
                "activity",
                {
                    activity:
                        profile.name,
                    answerType:
                        "activity",
                    decisionType:
                        "activity"
                }
            );

            return (
                `I wouldn't recommend **${profile.name}** outdoors during the available forecast window. ` +
                `Even the least-unfavorable period around **${formatTime(fallback.time)}** ` +
                `has a **${round(fallback.rainChance)}%** rain chance, ` +
                `feels like **${formatTemp(fallback.feels || fallback.temp)}**, ` +
                `and has wind around **${round(fallback.wind)} km/h**. ` +
                `${explainDecision(fallback)}`
            );
        }

        lastDecision = {
            type:
                "activity",
            hour:
                best,
            activity:
                profile.name,
            unsuitable:
                false,
            score:
                best.score,
            reasons:
                getWeatherFactors(
                    best
                )
        };

        updateConversationContext(
            question,
            "activity",
            {
                activity:
                    profile.name,
                answerType:
                    "activity",
                decisionType:
                    "activity"
            }
        );

        return (
            `For **${profile.name}**, I'd target around **${formatTime(best.time)}**. ` +
            `It should feel around **${formatTemp(best.feels || best.temp)}**, ` +
            `with a **${round(best.rainChance)}%** rain chance and ` +
            `wind around **${round(best.wind)} km/h**. ` +
            `${explainActivityHour(best, profile)}`
        );
    }

    /* ========================================================
       ANSWER: CLOTHING
       ======================================================== */

    function answerClothing() {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I need the current forecast before I can recommend what to wear."
            );
        }

        const best =
            findBestHour(
                hours
            );

        if (!best) {
            return (
                "I don't have enough forecast information for a clothing recommendation."
            );
        }

        lastDecision = {
            type:
                "clothing",
            hour:
                best
        };

        return (
            `${clothingAdvice(best)} ` +
            `The forecast around **${formatTime(best.time)}** feels like **${formatTemp(best.feels || best.temp)}**.`
        );
    }

    /* ========================================================
       ANSWER: TOMORROW
       ======================================================== */

    function answerTomorrow() {
        const hours =
            getFutureHours(
                1
            );

        if (
            !hours.length
        ) {
            return (
                "I don't have enough forecast data for tomorrow yet."
            );
        }

        const summary =
            summarizeDay(
                hours
            );

        const best =
            summary.best;

        const window =
            summary.bestWindow;

        lastDecision = {
            type:
                "tomorrow",
            hour:
                best,
            window
        };

        updateConversationContext(
            "",
            "tomorrow",
            {
                answerType:
                    "tomorrow",
                decisionType:
                    "tomorrow"
            }
        );

        let response =
            `Tomorrow looks like roughly **${formatTemp(summary.low)} to ${formatTemp(summary.high)}**. ` +
            `The highest rain chance is around **${round(summary.rainChance)}%**, ` +
            `with average wind near **${round(summary.avgWind)} km/h**. `;

        if (
            window
        ) {
            response +=
                `The best 2-hour outdoor window appears to be **${formatWeatherWindow(window)}**. `;
        } else if (
            best
        ) {
            response +=
                `The best available outdoor period appears to be around **${formatTime(best.time)}**. `;
        }

        if (
            best
        ) {
            response +=
                explainDecision(
                    best
                );
        }

        return response;
    }

    /* ========================================================
       ANSWER: WEATHER CHANGE
       ======================================================== */

    function answerChange() {
        const hours =
            getHourlyData();

        if (
            hours.length < 2
        ) {
            return (
                "I need more hourly forecast data to describe how the weather will change."
            );
        }

        const first =
            hours[0];

        const last =
            hours[
                Math.min(
                    5,
                    hours.length - 1
                )
            ];

        const changes = [];

        const tempDifference =
            toCelsius(
                last.feels ||
                last.temp
            ) -
            toCelsius(
                first.feels ||
                first.temp
            );

        if (
            Math.abs(
                tempDifference
            ) >= 2
        ) {
            changes.push(
                tempDifference > 0
                    ? `temperatures rise by about ${round(Math.abs(tempDifference))}°`
                    : `temperatures fall by about ${round(Math.abs(tempDifference))}°`
            );
        }

        const rainDifference =
            number(
                last.rainChance
            ) -
            number(
                first.rainChance
            );

        if (
            Math.abs(
                rainDifference
            ) >= 15
        ) {
            changes.push(
                rainDifference > 0
                    ? `rain chances increase from ${round(first.rainChance)}% to ${round(last.rainChance)}%`
                    : `rain chances decrease from ${round(first.rainChance)}% to ${round(last.rainChance)}%`
            );
        }

        const windDifference =
            number(last.wind) -
            number(first.wind);

        if (
            Math.abs(
                windDifference
            ) >= 8
        ) {
            changes.push(
                windDifference > 0
                    ? "wind increases"
                    : "wind eases"
            );
        }

        const rainTransitions =
            analyzeRainTransitions(
                hours
            );

        if (
            rainTransitions.exists &&
            rainTransitions.peak
        ) {
            changes.push(
                `the strongest rain signal is around ${formatTime(rainTransitions.peak.time)}`
            );
        }

        if (
            !changes.length
        ) {
            return (
                `The next few hours look fairly stable. ` +
                `It stays around **${formatTemp(first.feels || first.temp)}**, ` +
                `with rain chances around **${round(first.rainChance)}%**.`
            );
        }

        return (
            `Over the next few hours, ${changes.join(", ")}. ` +
            `Right now it feels around **${formatTemp(first.feels || first.temp)}** ` +
            `with a **${round(first.rainChance)}%** rain chance.`
        );
    }

    /* ========================================================
       ANSWER: AIR QUALITY
       ======================================================== */

    function answerAirQuality() {
        const air =
            window.airQualityData;

        if (!air) {
            return (
                "I don't have the live air-quality data available to the reasoning engine yet. " +
                "The weather forecast itself is available."
            );
        }

        const aqi =
            number(
                air.us_aqi ??
                air.european_aqi ??
                air.aqi
            );

        if (!aqi) {
            return (
                "Air-quality data is available, but I couldn't determine the current AQI value."
            );
        }

        let meaning =
            "generally acceptable air quality";

        if (
            aqi <= 50
        ) {
            meaning =
                "good air quality for most people";
        } else if (
            aqi <= 100
        ) {
            meaning =
                "moderate air quality";
        } else if (
            aqi <= 150
        ) {
            meaning =
                "air quality that may be less suitable for sensitive people";
        } else if (
            aqi <= 200
        ) {
            meaning =
                "unhealthy air quality";
        } else if (
            aqi <= 300
        ) {
            meaning =
                "very unhealthy air quality";
        } else {
            meaning =
                "hazardous air quality";
        }

        return (
            `The current AQI is around **${round(aqi)}**, which indicates **${meaning}**. ` +
            `For outdoor exercise, air quality should be considered alongside temperature, humidity, and rain.`
        );
    }

    /* ========================================================
       ANSWER: COMPARISON
       ======================================================== */

    function answerComparison() {
        const today =
            summarizeDay(
                getFutureHours(
                    0
                )
            );

        const tomorrow =
            summarizeDay(
                getFutureHours(
                    1
                )
            );

        if (
            !today ||
            !tomorrow
        ) {
            return (
                "I don't have enough forecast data to make a proper today-versus-tomorrow comparison."
            );
        }

        const differences = [];

        if (
            tomorrow.rainChance >
            today.rainChance + 15
        ) {
            differences.push(
                "tomorrow has a noticeably higher rain risk"
            );
        } else if (
            today.rainChance >
            tomorrow.rainChance + 15
        ) {
            differences.push(
                "today has a noticeably higher rain risk"
            );
        }

        if (
            tomorrow.high >
            today.high + 2
        ) {
            differences.push(
                "tomorrow is warmer"
            );
        } else if (
            today.high >
            tomorrow.high + 2
        ) {
            differences.push(
                "today is warmer"
            );
        }

        if (
            tomorrow.avgWind >
            today.avgWind + 8
        ) {
            differences.push(
                "tomorrow is windier"
            );
        } else if (
            today.avgWind >
            tomorrow.avgWind + 8
        ) {
            differences.push(
                "today is windier"
            );
        }

        if (
            tomorrow.bestWindow &&
            today.bestWindow
        ) {
            if (
                tomorrow.bestWindow.score >
                today.bestWindow.score + 10
            ) {
                differences.push(
                    "tomorrow has a stronger outdoor window"
                );
            } else if (
                today.bestWindow.score >
                tomorrow.bestWindow.score + 10
            ) {
                differences.push(
                    "today has a stronger outdoor window"
                );
            }
        }

        if (
            !differences.length
        ) {
            return (
                "Today and tomorrow look fairly similar overall, without a major difference in the available forecast factors."
            );
        }

        return (
            `The main differences are that ${differences.join(", and ")}.`
        );
    }

    /* ========================================================
       ANSWER: TEMPERATURE
       ======================================================== */

    function answerTemperature() {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I don't have enough temperature data yet."
            );
        }

        const current =
            hours[0];

        return (
            `It currently feels like **${formatTemp(current.feels || current.temp)}**. ` +
            `${temperatureSummary(current)} ` +
            `The actual temperature is around **${formatTemp(current.temp)}**.`
        );
    }

    /* ========================================================
       ANSWER: WIND
       ======================================================== */

    function answerWind() {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I don't have enough hourly wind data yet."
            );
        }

        const current =
            hours[0];

        const strongest =
            [...hours].sort(
                (a, b) =>
                    b.wind -
                    a.wind
            )[0];

        return (
            `Wind is currently around **${round(current.wind)} km/h**. ` +
            `The strongest wind in the available forecast is around **${round(strongest.wind)} km/h** at **${formatTime(strongest.time)}**.`
        );
    }

    /* ========================================================
       ANSWER: HUMIDITY
       ======================================================== */

    function answerHumidity() {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I don't have enough humidity data yet."
            );
        }

        const current =
            hours[0];

        if (
            current.humidity >= 90
        ) {
            return (
                `Humidity is currently around **${round(current.humidity)}%**, which is very high. ` +
                `That can make warm weather feel more uncomfortable.`
            );
        }

        if (
            current.humidity >= 75
        ) {
            return (
                `Humidity is around **${round(current.humidity)}%**, so the air may feel noticeably humid outdoors.`
            );
        }

        return (
            `Humidity is around **${round(current.humidity)}%**, which is relatively manageable.`
        );
    }

    /* ========================================================
       ANSWER: UV
       ======================================================== */

    function answerUV() {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I don't have enough UV data yet."
            );
        }

        const current =
            hours[0];

        let level =
            "low";

        if (
            current.uv >= 11
        ) {
            level =
                "extreme";
        } else if (
            current.uv >= 8
        ) {
            level =
                "very high";
        } else if (
            current.uv >= 6
        ) {
            level =
                "high";
        } else if (
            current.uv >= 3
        ) {
            level =
                "moderate";
        }

        return (
            `The current UV index is around **${round(current.uv)}**, which is **${level}**. ` +
            (
                current.uv >= 6
                    ? "Sun protection is a good idea during prolonged outdoor exposure."
                    : "UV exposure is currently relatively manageable."
            )
        );
    }

    /* ========================================================
       ANSWER: OUTDOOR
       ======================================================== */

    function answerOutdoor(
        question = ""
    ) {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I need the latest hourly forecast before judging outdoor conditions."
            );
        }

        const requested =
            getRequestedTimeContext(
                question
            );

        let targetHours =
            hours;

        if (
            requested.period
        ) {
            targetHours =
                findHoursByPeriod(
                    hours,
                    requested.period
                );
        }

        const best =
            findBestHour(
                targetHours
            );

        if (!best) {
            return (
                "I couldn't determine the outdoor conditions from the available forecast."
            );
        }

        const score =
            outdoorScore(
                best
            );

        const risk =
            classifyRisk(
                score,
                best
            );

        lastDecision = {
            type:
                "outdoor",
            hour:
                best,
            score,
            risk,
            reasons:
                getWeatherFactors(
                    best
                )
        };

        return (
            `The outdoor conditions are **${risk.label}** around **${formatTime(best.time)}**. ` +
            `It feels like **${formatTemp(best.feels || best.temp)}**, ` +
            `with a **${round(best.rainChance)}%** rain chance. ` +
            `${explainDecision(best)}`
        );
    }

    /* ========================================================
       ANSWER: GENERAL
       ======================================================== */

    function answerGeneral() {
        const hours =
            getHourlyData();

        if (
            !hours.length
        ) {
            return (
                "I'm waiting for the latest weather data before giving you a detailed analysis."
            );
        }

        const current =
            hours[0];

        const condition =
            weatherCodeInfo(
                current.code
            );

        return (
            `Right now, it feels around **${formatTemp(current.feels || current.temp)}**, ` +
            `with **${condition.label}**, ` +
            `a **${round(current.rainChance)}%** rain chance, ` +
            `wind around **${round(current.wind)} km/h**, ` +
            `humidity around **${round(current.humidity)}%**, ` +
            `and UV around **${round(current.uv)}**. ` +
            `${temperatureSummary(current)}`
        );
    }

    /* ========================================================
       ANSWER: WHY
       ======================================================== */

    function answerWhy() {
        if (
            !lastDecision?.hour
        ) {
            return (
                "I haven't made a specific weather recommendation immediately before that question."
            );
        }

        const decision =
            lastDecision;

        if (
            decision.unsuitable
        ) {
            return (
                `I didn't recommend that period because the conditions are unfavorable for ${decision.activity}. ` +
                `${explainDecision(decision.hour)}`
            );
        }

        if (
            decision.activity &&
            decision.hour
        ) {
            return (
                `For ${decision.activity}, I focused mainly on rain, wind, temperature, humidity and UV. ` +
                `${explainDecision(decision.hour)} ` +
                `${explainHour(decision.hour)}`
            );
        }

        if (
            decision.window
        ) {
            return (
                explainWeatherWindow(
                    decision.window
                ) +
                " " +
                explainDecision(
                    decision.hour
                )
            );
        }

        return (
            explainDecision(
                decision.hour
            ) +
            " " +
            explainHour(
                decision.hour
            )
        );
    }

    /* ========================================================
       FOLLOW-UP CONTEXT
       ======================================================== */

    function answerContextualFollowUp(
        question
    ) {
        const text =
            normalize(question);

        /*
         * "Why?" is always tied to the
         * previous decision.
         */
        if (
            /^why( not)?$/.test(
                text
            ) ||
            /^(how come|why is that)$/.test(
                text
            )
        ) {
            return answerWhy();
        }

        /*
         * "What about tomorrow?"
         */
        if (
            /what about tomorrow|and tomorrow|tomorrow then|how about tomorrow/.test(
                text
            )
        ) {
            return answerTomorrow();
        }

        /*
         * "What about 6 PM?"
         */
        if (
            parseClockTime(text) ||
            detectTimeOfDay(text)
        ) {
            return answerTimeSpecific(
                text
            );
        }

        /*
         * "What about walking?"
         * Uses previous conversation when possible.
         */
        if (
            /what about|how about|what if/.test(
                text
            ) &&
            /walk|walking|run|running|cycle|cycling|bike|travel|drive|sport|picnic/.test(
                text
            )
        ) {
            return answerActivity(
                text
            );
        }

        /*
         * "What about outside?"
         */
        if (
            /what about|how about/.test(
                text
            ) &&
            /outside|outdoor|going out|go out/.test(
                text
            )
        ) {
            return answerOutdoor(
                text
            );
        }

        return null;
    }

    /* ========================================================
       MAIN ENGINE
       ======================================================== */

    function answer(
        question
    ) {
        const rawQuestion =
            String(
                question || ""
            ).trim();

        if (
            !rawQuestion
        ) {
            return (
                "Ask me something about the weather and I'll analyze it for you."
            );
        }

        /*
         * First try contextual follow-up handling.
         */
        if (
            isContextOnlyFollowUp(
                rawQuestion
            )
        ) {
            const contextual =
                answerContextualFollowUp(
                    rawQuestion
                );

            if (
                contextual
            ) {
                return contextual;
            }
        }

        const intent =
            detectIntent(
                rawQuestion
            );

        updateConversationContext(
            rawQuestion,
            intent
        );

        switch (
            intent
        ) {
            case "best-time":
                return answerBestTime43(
                    rawQuestion
                );

            case "worst-time":
                return answerWorstTime();

            case "rain-timing":
                return answerRainTiming();

            case "time-specific":
                return answerTimeSpecific(
                    rawQuestion
                );

            case "activity":
                return answerActivity(
                    rawQuestion
                );

            case "clothing":
                return answerClothing();

            case "tomorrow":
                return answerTomorrow();

            case "change":
                return answerChange();

            case "air-quality":
                return answerAirQuality();

            case "comparison":
                return answerComparison();

            case "temperature":
                return answerTemperature();

            case "rain":
                return answerRainTiming();

            case "why":
                return answerWhy();

            case "wind":
                return answerWind();

            case "humidity":
                return answerHumidity();

            case "uv":
                return answerUV();

            case "outdoor":
                return answerOutdoor(
                    rawQuestion
                );

            case "general":
            default:
                return answerGeneral();
        }
    }

    /* ========================================================
       PUBLIC API — CLOUDORA AI 4.3
       ======================================================== */

    const CloudoraAI43API = {

        version:
            VERSION,

        answer,

        getHourlyData,

        getFutureHours,

        findBestHour,

        findWorstHour,

        findRainWindow,

        findBestWeatherWindow,

        scoreWeatherWindow,

        analyzeRainTransitions,

        calculateRecommendationConfidence,

        analyzeActivity,

        clothingAdvice,

        explainHour,

        weatherCodeInfo,

        getWeatherFactors,

        classifyRisk,

        parseClockTime,

        detectTimeOfDay,

        getConversationContext() {
            return {
                ...conversationContext
            };
        },

        refresh() {
            lastDecision =
                null;

            conversationContext = {
                lastQuestion: "",
                lastIntent: "",
                lastActivity: "",
                lastTime: null,
                lastTimeLabel: "",
                lastAnswerType: "",
                lastDecisionType: ""
            };
        },

        getLastDecision() {
            return lastDecision;
        }
    };

    /* ========================================================
       PUBLIC API
       ======================================================== */

    /*
     * Primary 4.3 API.
     */
    window.CloudoraAI43 =
        CloudoraAI43API;

    /*
     * 4.2 compatibility.
     *
     * Existing code can continue using CloudoraAI42.
     */
    window.CloudoraAI42 =
        CloudoraAI43API;

    /*
     * 4.1 compatibility.
     *
     * Existing ai-engine.js can continue using
     * CloudoraAI41 without breaking.
     */
    window.CloudoraAI41 =
        CloudoraAI43API;

    console.log(
        `Cloudora AI ${VERSION} — Conversational Weather Intelligence loaded.`
    );

})();