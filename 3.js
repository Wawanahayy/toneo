const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');

let socket = null;
let pingInterval;
let logInterval;
let potentialPoints = 0;
let pointsTotal = 0;
let pointsToday = 0;
let startTime = new Date();

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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

async function connectWebSocket(email) {
    if (socket) return;
    const url = "wss://secure.ws.teneo.pro";
    const wsUrl = `${url}/websocket?email=${encodeURIComponent(email)}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = async () => {
        console.log("WebSocket connected");
        startPinging();
        startLogUpdates();
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
            await setLocalStorage({
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
    console.log('Stopping...');
    stopPinging();
    stopLogUpdates();
    disconnectWebSocket();
    process.exit(0);
});

rl.question("Masukkan email: ", (email) => {
    connectWebSocket(email);
});
