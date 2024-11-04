const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const chalk = require('chalk');

let sockets = [];
let pingIntervals = [];
let lastPingTime;
let pingInterval = 30000; // Dapat dikonfigurasi
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
            connectWebSocket(account.userId, account.email, proxy);
        }
    }, 5000); // Reconnect after 5 seconds
}

function startPing(socket, email) {
    setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            lastPingTime = Date.now();
            socket.send(JSON.stringify({ type: "ping" }));
            const account = accountsData.find(account => account.email === email);
            if (account) {
                account.pingStatus = 'Active';
            }
        }
    }, pingInterval);
}

function getRandomColor() {
    const colors = [chalk.red, chalk.green, chalk.yellow, chalk.blue, chalk.magenta, chalk.cyan];
    return colors[Math.floor(Math.random() * colors.length)];
}

function updateDisplay() {
    const currentTime = formatDate(new Date());
    const elapsedTime = calculateElapsedTime();

    const leftColumn = [];
    const rightColumn = [];

    leftColumn.push('--------------------------------------------------------------------------------');
    rightColumn.push('--------------------------------------------------------------------------------');

    accountsData.forEach((account, index) => {
        const pointsToday = account.pointsToday || 0;
        const pointsTotal = account.pointsTotal || 0;
        const proxyStatus = account.proxy ? 'true' : 'false';
        const pingStatus = account.pingStatus || 'Inactive';
        const websocketStatus = account.socket && account.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected';

        const color = getRandomColor(); // Mendapatkan warna acak

        if (index % 2 === 0) { // Kolom kiri
            leftColumn.push(color(`AKUN ${index + 1}: ${account.email.padEnd(35)}`));
            leftColumn.push(color(`DATE/JAM   : ${currentTime.padEnd(30)}`));
            leftColumn.push(color(`Poin DAILY : ${pointsToday.toString().padEnd(30)}`));
            leftColumn.push(color(`Total Poin : ${pointsTotal.toString().padEnd(30)}`));
            leftColumn.push(color(`Proxy      : ${proxyStatus.padEnd(30)}`));
            leftColumn.push(color(`PING       : ${pingStatus.padEnd(30)}`));
            leftColumn.push(color(`TIME RUN   : ${elapsedTime.padEnd(30)}`));
            leftColumn.push(color(`Websocket  : ${websocketStatus.padEnd(30)}`));
            leftColumn.push(color(`TELEGRAM   : @AirdropJP_JawaPride`.padEnd(43)));
            leftColumn.push('--------------------------------------------------------------------------------');
        } else { // Kolom kanan
            rightColumn.push(color(`AKUN ${index + 1}: ${account.email.padEnd(36)}`));
            rightColumn.push(color(`DATE/JAM   : ${currentTime.padEnd(30)}`));
            rightColumn.push(color(`Poin DAILY : ${pointsToday.toString().padEnd(30)}`));
            rightColumn.push(color(`Total Poin : ${pointsTotal.toString().padEnd(30)}`));
            rightColumn.push(color(`Proxy      : ${proxyStatus.padEnd(30)}`));
            rightColumn.push(color(`PING       : ${pingStatus.padEnd(30)}`));
            rightColumn.push(color(`TIME RUN   : ${elapsedTime.padEnd(30)}`));
            rightColumn.push(color(`Websocket  : ${websocketStatus.padEnd(30)}`));
            rightColumn.push(color(`TELEGRAM   : @AirdropJP_JawaPride`.padEnd(43)));
            rightColumn.push('---------------------------------------------------------------------------------');
        }
    });

    console.clear();
    console.log(leftColumn.join('\n'));
    console.log(rightColumn.join('\n'));
}

async function getUserId(account, index) {
    const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
    const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
    const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGV5Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

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
                console.log(`User ID for account ${index + 1} (${email}) retrieved successfully.`);
                resolve(response.data.user.id);
            } else {
                console.error(`Failed to retrieve user ID for account ${index + 1} (${email}):`, response.data);
                resolve(null);
            }
        } catch (error) {
            console.error(`Error retrieving user ID for account ${index + 1} (${email}):`, error);
            resolve(null);
        }
    });
}

async function main() {
    const config = await getConfig();
    const accounts = config.accounts || [];

    startTime = new Date(); // Mencatat waktu mulai
    for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        account.userId = await getUserId(account, index);
        if (account.userId) {
            accountsData.push(account);
            connectWebSocket(account.userId, account.email, account.proxy);
        }
    }
}

main().catch(console.error);
