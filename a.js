const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const colorList = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m', '\x1b[36m'];
const colorReset = '\x1b[0m';

let sockets = [];
let pingIntervals = [];
let lastPingTime;
let pingInterval = 30000; // Interval ping, dapat dikonfigurasi
let accountsData = [];
let startTime;

function formatDate(date) {
    return date.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
}

function formatElapsedTime(elapsedMilliseconds) {
    const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function calculateElapsedTime() {
    return formatElapsedTime(new Date() - startTime);
}

async function getConfig() {
    try {
        const data = await promisify(fs.readFile)('config.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading config.json:", error);
        return {};
    }
}

async function connectWebSocket(userId, email, proxy) {
    const version = "v0.2";
    const url = "wss://secure.ws.teneo.pro";
    const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
    let agent;

    if (proxy) {
        const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
        agent = new HttpsProxyAgent(proxyUrl);
    }

    const socket = new WebSocket(wsUrl, { agent });

    socket.onopen = () => {
        console.log(`WebSocket connected for user: ${email}`);
        const account = accountsData.find(account => account.email === email);
        if (account) {
            account.socket = socket;
            account.pingStatus = 'Active';
        }
        startPing(socket, email);
        startBlinkingColorMessage();
        updateDisplay();
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data, email);
    };

    socket.onclose = () => {
        console.log(`WebSocket disconnected for user: ${email}`);
        handleReconnect(email, proxy);
    };

    socket.onerror = (error) => {
        console.error(`WebSocket error for user ${email}:`, error);
    };
}

function handleIncomingMessage(data, email) {
    if (data.type === "pong") {
        const pingTime = Date.now() - lastPingTime;
        console.log(`Ping untuk user ${email}: ${pingTime} ms`);
        const account = accountsData.find(account => account.email === email);
        if (account) {
            account.pingStatus = 'Active';
        }
    }

    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
        const account = accountsData.find(account => account.email === email);
        if (account) {
            account.pointsTotal = data.pointsTotal;
            account.pointsToday = data.pointsToday;
            updateDisplay();
        }
    }
}

function handleReconnect(email, proxy) {
    console.log(`Attempting to reconnect WebSocket for user: ${email}`);
    setTimeout(() => {
        const account = accountsData.find(account => account.email === email);
        if (account) {
            connectWebSocket(account.userId, email, proxy);
        }
    }, 5000); // Reconnect after 5 seconds
}

function startPing(socket, email) {
    const pingId = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            lastPingTime = Date.now();
            socket.send(JSON.stringify({ type: "ping" }));
            const account = accountsData.find(account => account.email === email);
            if (account) {
                account.pingStatus = 'Active';
            }
        }
    }, pingInterval);
    pingIntervals.push(pingId);
}

function updateDisplay() {
    const currentTime = formatDate(new Date());
    const elapsedTime = calculateElapsedTime();

    console.clear();

    let leftColumn = [];
    let rightColumn = [];

    accountsData.forEach((account, index) => {
        const websocketStatus = account.socket && account.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected';
        const proxyStatus = account.proxy ? 'true' : 'false';
        const pingStatus = account.pingStatus || 'Inactive';

        const pointsToday = account.pointsToday ?? 0;
        const pointsTotal = account.pointsTotal ?? 0;

        const color = colorList[index % colorList.length]; // Mengambil warna saat ini

        const displayAccount = (column, idx) => {
            column.push(`${color}--------------------------------------------------------------------------------${colorReset}`);
            column.push(`${color}AKUN ${idx + 1}: ${account.email.padEnd(35)}${colorReset}`);
            column.push(`${color}DATE/JAM   : ${currentTime.padEnd(30)}${colorReset}`);
            column.push(`${color}Poin DAILY : ${pointsToday.toString().padEnd(30)}${colorReset}`);
            column.push(`${color}Total Poin : ${pointsTotal.toString().padEnd(30)}${colorReset}`);
            column.push(`${color}Proxy      : ${proxyStatus.padEnd(30)}${colorReset}`);
            column.push(`${color}PING       : ${pingStatus.padEnd(30)}${colorReset}`);
            column.push(`${color}TIME RUN   : ${elapsedTime.padEnd(30)}${colorReset}`);
            column.push(`${color}Websocket  : ${websocketStatus.padEnd(30)}${colorReset}`);
            column.push(`${color}TELEGRAM   : @AirdropJP_JawaPride`.padEnd(43) + `${colorReset}`);
            column.push(`${color}--------------------------------------------------------------------------------${colorReset}`);
        };

        if (index % 2 === 0) {
            displayAccount(leftColumn, index);
        } else {
            displayAccount(rightColumn, index);
        }
    });

    for (let i = 0; i < Math.max(leftColumn.length, rightColumn.length); i++) {
        const leftLine = leftColumn[i] || '';
        const rightLine = rightColumn[i] || '';
        console.log(`${leftLine} | ${rightLine}`);
    }
}

function startBlinkingColorMessage() {
    setInterval(updateDisplay, 1000);
}

async function getUserId(account, index) {
    const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
    const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
    const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

    const email = account.email;
    const password = account.password;

    return new Promise(async (resolve) => {
        try {
            const response = await axios.post(loginUrl, { email, password }, {
                headers: {
                    authorization,
                    apikey,
                    "Content-Type": "application/json"
                }
            });

            if (response.data && response.data.user) {
                console.log(`User ID for account ${index + 1}: ${response.data.user.id}`);
                fs.appendFileSync('logs.txt', `User ID for account ${index + 1}: ${response.data.user.id}\n`, 'utf8');
                resolve(response.data.user.id);
            } else {
                console.error(`User not found for account ${index + 1}.`);
                resolve(null);
            }
        } catch (error) {
            console.error(`Error during login for account ${index + 1}:`, error.response ? error.response.data : error.message);
            resolve(null);
        }
    });
}

async function main() {
    const config = await getConfig();

    if (!config.accounts || config.accounts.length === 0) {
        console.error("No accounts found in config.json.");
        return;
    }

    accountsData = config.accounts.map(account => ({
        email: account.email,
        password: account.password,
        userId: null,
        pointsToday: null,
        pointsTotal: null,
        pingStatus: null,
        socket: null,
        proxy: account.proxy || null // Jika proxy tidak disediakan, ini akan menjadi null
    }));

    startTime = new Date();
    console.log(`Script started at ${formatDate(startTime)}`);

    for (let i = 0; i < accountsData.length; i++) {
        const account = accountsData[i];
        account.userId = await getUserId(account, i);
        if (account.userId) {
            await connectWebSocket(account.userId, account.email, account.proxy);
        } else {
            console.error(`Unable to connect WebSocket for account ${account.email} due to missing user ID.`);
        }
    }
}

main();
