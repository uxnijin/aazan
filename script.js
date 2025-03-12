const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
let prayerTimes = {};
let coords = { latitude: null, longitude: null };
let iqamaOffsets = JSON.parse(localStorage.getItem("iqamaOffsets")) || {
    Fajr: 10, Dhuhr: 10, Asr: 10, Maghrib: 10, Isha: 10
};
let calcMethod = localStorage.getItem("calcMethod") || "MWL";

// DOM Elements
const locationEl = document.getElementById("location");
const countdownEl = document.getElementById("countdown-time");
const nextPrayerNameEl = document.getElementById("next-prayer-name");
const prayerTableEl = document.getElementById("prayer-table");
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const closeSettingsBtn = document.getElementById("close-settings");
const saveSettingsBtn = document.getElementById("save-settings");
const locationSearch = document.getElementById("location-search");
const suggestionsList = document.getElementById("location-suggestions");
const useCurrentLocationBtn = document.getElementById("use-current-location");
const calcMethodSelect = document.getElementById("calc-method");
const settingsLocationEl = document.getElementById("settings-location");
const iqamaInputs = {
    Fajr: document.getElementById("fajr-iqama"),
    Dhuhr: document.getElementById("dhuhr-iqama"),
    Asr: document.getElementById("asr-iqama"),
    Maghrib: document.getElementById("maghrib-iqama"),
    Isha: document.getElementById("isha-iqama")
};
const locationPopup = document.getElementById("location-popup");
const retryLocationBtn = document.getElementById("retry-location");
const closeLocationPopupBtn = document.getElementById("close-location-popup");

// Get User Location
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                coords.latitude = position.coords.latitude;
                coords.longitude = position.coords.longitude;
                fetchPrayerTimes();
                reverseGeocode(coords.latitude, coords.longitude, true);
            },
            () => {
                locationPopup.classList.remove("hidden");
                coords.latitude = 51.5074; // Default: London
                coords.longitude = -0.1278;
                fetchPrayerTimes();
                reverseGeocode(coords.latitude, coords.longitude, false);
            }
        );
    } else {
        locationEl.textContent = "Geolocation not supported.";
        settingsLocationEl.textContent = "Geolocation not supported.";
    }
}

function reverseGeocode(lat, lon, isSelected = false) {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        .then(response => response.json())
        .then(data => {
            const locationName = data.display_name.split(",")[0];
            locationEl.textContent = locationName;
            settingsLocationEl.textContent = locationName;
            if (isSelected) {
                locationEl.classList.add("font-bold", "bg-indigo-500", "text-white", "px-2", "py-1", "rounded-2xl");
                settingsLocationEl.classList.add("font-bold", "bg-indigo-500", "text-white", "px-2", "py-1", "rounded-2xl");
            } else {
                locationEl.classList.remove("font-bold", "bg-indigo-500", "text-white", "px-2", "py-1", "rounded-2xl");
                settingsLocationEl.classList.remove("font-bold", "bg-indigo-500", "text-white", "px-2", "py-1", "rounded-2xl");
            }
        })
        .catch(() => {
            locationEl.textContent = "Unable to fetch location name";
            settingsLocationEl.textContent = "Unable to fetch location name";
        });
}

// Fetch Prayer Times from API
function fetchPrayerTimes() {
    const date = new Date().toISOString().split("T")[0];
    fetch(`http://api.aladhan.com/v1/timings/${date}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=${getMethodCode(calcMethod)}`)
        .then(response => response.json())
        .then(data => {
            prayerTimes = data.data.timings;
            updateUI();
            startCountdown();
        })
        .catch(() => {
            locationEl.textContent = "Error fetching prayer times";
            settingsLocationEl.textContent = "Error fetching prayer times";
        });
}

function getMethodCode(method) {
    const methods = {
        MWL: 3, ISNA: 2, Egypt: 5, Makkah: 4, Karachi: 1, Tehran: 7, Jafari: 0,
        Gulf: 8, Kuwait: 9, Qatar: 10, Moonsighting: 11, Dubai: 12
    };
    return methods[method] || 3;
}

// Update UI with Prayer Times (12-hour format)
function updateUI() {
    prayerTableEl.innerHTML = "";
    prayers.forEach(prayer => {
        const time = prayerTimes[prayer];
        const iqamaTime = addMinutes(time, iqamaOffsets[prayer]);
        const row = `
            <tr class="border-b border-black border-opacity-10 dark:border-white dark:border-opacity-20">
                <td class="py-2 text-black dark:text-white text-base font-inter">${prayer}</td>
                <td class="py-2 text-black dark:text-white text-base font-inter">${formatTime12Hour(time)}</td>
                <td class="py-2 text-black dark:text-white text-base font-inter">${formatTime12Hour(iqamaTime)}</td>
            </tr>
        `;
        prayerTableEl.innerHTML += row;
    });
}

function addMinutes(time, minutes) {
    const [hours, mins] = time.split(":").map(Number);
    const totalMins = hours * 60 + mins + Number(minutes);
    const newHours = Math.floor(totalMins / 60) % 24;
    const newMins = totalMins % 60;
    return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
}

function formatTime12Hour(time) {
    if (!time) return "--:--";
    const [hours, mins] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const adjustedHours = hours % 12 || 12;
    return `${String(adjustedHours).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
}

// Countdown to Next Prayer
function startCountdown() {
    setInterval(() => {
        const now = new Date();
        let nextPrayer = null;
        let minDiff = Infinity;

        prayers.forEach(prayer => {
            const [hours, mins] = prayerTimes[prayer].split(":").map(Number);
            const prayerDate = new Date(now);
            prayerDate.setHours(hours, mins, 0, 0);
            const diff = prayerDate - now;
            if (diff > 0 && diff < minDiff) {
                minDiff = diff;
                nextPrayer = prayer;
            }
        });

        if (nextPrayer) {
            nextPrayerNameEl.textContent = nextPrayer;
            const secondsLeft = Math.floor(minDiff / 1000);
            const hours = Math.floor(secondsLeft / 3600);
            const mins = Math.floor((secondsLeft % 3600) / 60);
            const secs = secondsLeft % 60;
            countdownEl.textContent = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        } else {
            nextPrayerNameEl.textContent = "Tomorrow";
            countdownEl.textContent = "--:--:--";
        }
    }, 1000);
}

// Settings and Location Search
settingsBtn.addEventListener("click", () => {
    settingsOverlay.style.display = "flex";
    calcMethodSelect.value = calcMethod;
    Object.keys(iqamaInputs).forEach(key => {
        iqamaInputs[key].value = iqamaOffsets[key];
    });
});

closeSettingsBtn.addEventListener("click", () => {
    settingsOverlay.style.display = "none";
});

saveSettingsBtn.addEventListener("click", () => {
    calcMethod = calcMethodSelect.value;
    localStorage.setItem("calcMethod", calcMethod);
    Object.keys(iqamaInputs).forEach(key => {
        iqamaOffsets[key] = Number(iqamaInputs[key].value) || 10;
    });
    localStorage.setItem("iqamaOffsets", JSON.stringify(iqamaOffsets));
    fetchPrayerTimes();
    settingsOverlay.style.display = "none";
});

locationSearch.addEventListener("input", debounce(async (e) => {
    const query = e.target.value;
    if (query.length < 3) {
        suggestionsList.innerHTML = "";
        return;
    }
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5`);
    const data = await response.json();
    suggestionsList.innerHTML = data.map(item => `
        <li class="p-2 hover:bg-indigo-500 hover:text-white cursor-pointer text-black dark:text-white text-base font-inter" data-lat="${item.lat}" data-lon="${item.lon}">
            ${item.display_name}
        </li>
    `).join("");
    suggestionsList.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
            coords.latitude = li.dataset.lat;
            coords.longitude = li.dataset.lon;
            locationEl.textContent = li.textContent.split(",")[0];
            settingsLocationEl.textContent = li.textContent.split(",")[0];
            locationEl.classList.add("font-bold", "bg-indigo-500", "text-white", "px-2", "py-1", "rounded-2xl");
            settingsLocationEl.classList.add("font-bold", "bg-indigo-500", "text-white", "px-2", "py-1", "rounded-2xl");
            fetchPrayerTimes();
            suggestionsList.innerHTML = "";
            locationSearch.value = "";
        });
    });
}, 300));

useCurrentLocationBtn.addEventListener("click", () => {
    getLocation();
    settingsOverlay.style.display = "none";
});

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Location Popup Handlers
retryLocationBtn.addEventListener("click", () => {
    locationPopup.classList.add("hidden");
    getLocation();
});

closeLocationPopupBtn.addEventListener("click", () => {
    locationPopup.classList.add("hidden");
    locationEl.textContent = "Using default location (London)";
    settingsLocationEl.textContent = "Using default location (London)";
});

// Initialize the App
getLocation();