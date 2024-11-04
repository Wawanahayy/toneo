const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const colors = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m'];

let sockets = [];
let pingIntervals = [];
let isFirstMessage = {};
let currentColorIndex = 0;
let lastPingTime;
let pingInterval = 30000; // You can make this configurable
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

  const accountLines = accountsData.map((account, index) => {
    const websocketStatus = account.socket && account.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected';
    const proxyStatus = account.proxy ? 'true' : 'false';
    const pingStatus = account.pingStatus || 'Inactive';

    return {
      index: index + 1,
      email: account.email,
      currentTime: currentTime,
      pointsToday: account.pointsToday,
      pointsTotal: account.pointsTotal,
      proxyStatus: proxyStatus,
      pingStatus: pingStatus,
      elapsedTime: elapsedTime,
      websocketStatus: websocketStatus,
    };
  });

  // Menampilkan informasi akun secara bersebelahan
  const accountDisplayLines = accountLines.reduce((acc, account, index) => {
    const lineIndex = Math.floor(index / 2);
    if (!acc[lineIndex]) acc[lineIndex] = [];
    acc[lineIndex].push(account);
    return acc;
  }, []);

  accountDisplayLines.forEach(line => {
    const lineOutput = line.map(account => `
      AKUN ${account.index}: ${account.email}                 | 
      DATE/JAM  : ${account.currentTime}                         | 
      Poin DAILY: ${account.pointsToday}                          | 
      Total Poin: ${account.pointsTotal}                           | 
      Proxy     : ${account.proxyStatus}                           | 
      PING      : ${account.pingStatus}                            | 
      TIME RUN  : ${account.elapsedTime}                           | 
      Websocket : ${account.websocketStatus}                       | 
      TELEGRAM  : @AirdropJP_JawaPride
    `.trim()).join('\n');

    console.log(lineOutput);
    console.log('-----------------------------------------------------------------------------------');
  });
}

function startBlinkingColorMessage() {
  setInterval(updateDisplay, 1000);
}

async function getUserId(account, index) {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
  const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

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
  const accounts = config.accounts;

  startTime = new Date();

  for (const account of accounts) {
    if (account.email && account.password) {
      const userId = await getUserId(account, accountsData.length);
      if (userId) {
        // Hanya menambahkan akun jika userId valid
        accountsData.push({
          email: account.email,
          pointsTotal: 0,
          pointsToday: 0,
          proxy: account.proxy ? true : false,
          pingStatus: 'Inactive',
          userId: userId,
          socket: null
        });
        connectWebSocket(userId, account.email, account.proxy);
      }
    }
  }
}

main().catch(console.error);