const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

let socket = null;
let pingInterval;
let countdownInterval;
let logInterval;
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;
let startTime = new Date(); // Menyimpan waktu mulai

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk mencetak teks berwarna
function printColored(colorCode, text) {
    console.log(`\x1b[${colorCode}m${text}\x1b[0m`);
}

// Fungsi untuk menampilkan teks berwarna
function displayColoredText() {
    printColored("40;96", "============================================================");
    printColored("42;37", "=======================  J.W.P.A  ==========================");
    printColored("45;97", "================= @AirdropJP_JawaPride =====================");
    printColored("43;30", "=============== https://x.com/JAWAPRIDE_ID =================");
    printColored("41;97", "============= https://linktr.ee/Jawa_Pride_ID ==============");
    printColored("44;30", "============================================================");
}

// Menampilkan header
displayColoredText();
setTimeout(() => {
    console.clear();
}, 5000);

async function getLocalStorage() {
    try {
        const data = await readFileAsync('localStorage.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

async function setLocalStorage(data) {
    const currentData = await getLocalStorage();
    const newData = { ...currentData, ...data };
    await writeFileAsync('localStorage.json', JSON.stringify(newData));
}

async function connectWebSocket(userId) {
    if (socket) return;
    const version = "v0.2";
    const url = "wss://secure.ws.teneo.pro";
    const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = async () => {
        const connectionTime = new Date();
        const formattedConnectionTime = formatDate(connectionTime);
        await setLocalStorage({ lastUpdated: connectionTime.toISOString() });
        console.log("WebSocket connected at", formattedConnectionTime);
        startPinging();
        startCountdownAndPoints();
        startLogUpdates();
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        const messageTime = new Date(data.date);
        const formattedMessageTime = formatDate(messageTime);
        
        data.DATE = formattedMessageTime;
        console.log(`Received message from WebSocket:`, {
            ...data,
            currentTime: formatDate(new Date())
        });

        if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
            const lastUpdated = new Date().toISOString();
            await setLocalStorage({
                lastUpdated: lastUpdated,
                pointsTotal: data.pointsTotal,
                pointsToday: data.pointsToday,
            });
            pointsTotal = data.pointsTotal;
            pointsToday = data.pointsToday;
        }
    };

    socket.onclose = () => {
        socket = null;
        console.log("WebSocket disconnected");
        stopPinging();
        stopLogUpdates();
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
}

function disconnectWebSocket() {
    if (socket) {
        socket.close();
        socket = null;
        stopPinging();
        stopLogUpdates();
    }
}

function startPinging() {
    stopPinging();
    pingInterval = setInterval(async () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "PING" }));
            await setLocalStorage({ lastPingDate: new Date().toISOString() });
        }
    }, 10000);
}

function stopPinging() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

function startLogUpdates() {
    stopLogUpdates();
    logInterval = setInterval(async () => {
        const localStorageData = await getLocalStorage();
        console.log(`Log Update: \n - Points Today: ${localStorageData.pointsToday || 0} \n - Points Total: ${localStorageData.pointsTotal || 0} \n - Potential Points: ${potentialPoints}`);
    }, 300000);
}

function stopLogUpdates() {
    if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
    }
}

process.on('SIGINT', () => {
    console.log('Received SIGINT. Stopping pinging and log updates...');
    stopPinging();
    stopLogUpdates();
    disconnectWebSocket();
    process.exit(0);
});

let currentColorIndex = 0;
const colors = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m', '\x1b[36m', '\x1b[37m', '\x1b[0m'];


function getTimeRunning() {
    const now = new Date();
    const diff = now - startTime; 
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; // Format MM:SS
}

function updateBlinkingColorMessage() {
    console.clear(); 
    const currentTime = formatDate(new Date());
    const websocketStatus = socket && socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'; 
    const timeRunning = getTimeRunning(); // Dapatkan waktu berjalan
    console.log(`---------------------`);
    console.log(`${colors[currentColorIndex]}Waktu Saat Ini: ${currentTime}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Poin Hari Ini: ${pointsToday}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Total Poin: ${pointsTotal}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Websocket: ${websocketStatus}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}FOLLOW TG: @AirdropJP_JawaPride\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}TIME RUN: ${timeRunning}\x1b[0m`); // Tampilkan waktu berjalan
    console.log(`---------------------`);
    currentColorIndex = (currentColorIndex + 1) % colors.length;
}

function startCountdownAndPoints() {
    clearInterval(countdownInterval);
    updateCountdownAndPoints();
    countdownInterval = setInterval(() => {
        updateCountdownAndPoints();
        updateBlinkingColorMessage();
    }, 1000);
}

async function updateCountdownAndPoints() {
    const { lastUpdated } = await getLocalStorage();
    if (lastUpdated) {
        const nextHeartbeat = new Date(lastUpdated);
        nextHeartbeat.setMinutes(nextHeartbeat.getMinutes() + 15);
        const now = new Date();
        const diff = nextHeartbeat.getTime() - now.getTime();

        if (diff > 0) {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            countdown = `${minutes}m ${seconds}s`;

            const maxPoints = 25;
            const timeElapsed = now.getTime() - new Date(lastUpdated).getTime();
            const timeElapsedMinutes = timeElapsed / (60 * 1000);
            let newPoints = Math.min(maxPoints, (timeElapsedMinutes / 15) * maxPoints);
            newPoints = parseFloat(newPoints.toFixed(2));

            if (Math.random() < 0.1) {
                const bonus = Math.random() * 2;
                newPoints = Math.min(maxPoints, newPoints + bonus);
                newPoints = parseFloat(newPoints.toFixed(2));
            }

            potentialPoints = newPoints;
        } else {
            countdown = "Calculating...";
            potentialPoints = 25;
        }
    } else {
        countdown = "Calculating...";
        potentialPoints = 0;
    }
}

function formatDate(date) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return date.toLocaleString('en-US', options).replace(',', '');
}


rl.question("Masukkan userId: ", (userId) => {
    connectWebSocket(userId);
});
