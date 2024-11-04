const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');

let accountsData = [];
let currentColorIndex = 0;
const colors = [
  '\x1b[31m',
  '\x1b[32m',
  '\x1b[33m',
  '\x1b[34m',
  '\x1b[35m',
  '\x1b[36m'
];

let startTime;
let lastPingTime;
let pingInterval = 5000; 

// Fungsi format dan kalkulasi waktu
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

// Membaca akun dan proxy
async function readJsonFile(filePath) {
  try {
    const data = await promisify(fs.readFile)(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
}

async function connectWebSocket(userId, email, proxy) {
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
  let agent;
  
  // Gunakan proxy jika ada
  if (proxy) {
    const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    agent = new HttpsProxyAgent(proxyUrl);
  }
  
  const socket = new WebSocket(wsUrl, { agent });

  socket.onopen = async () => {
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

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
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
  };

  socket.onclose = () => {
    console.log(`WebSocket disconnected for user: ${email}`);
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for user ${email}:`, error);
  };
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

function updateDisplay() {
  const currentTime = formatDate(new Date());
  const elapsedTime = calculateElapsedTime();

  console.clear();

  accountsData.forEach((account, index) => {
    const websocketStatus = account.socket && account.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected';
    const proxyStatus = account.proxy ? 'true' : 'false';
    const pingStatus = account.pingStatus || 'Inactive'; 

    console.log(`------------------------------------`);
    console.log(`${colors[currentColorIndex]}Waktu Saat Ini: ${currentTime}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}AKUN ${index + 1}: ${account.email}\x1b[0m`);
    console.log(`${colors[currentColorIndex]}Poin Hari Ini: ${account.pointsToday}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Total Poin: ${account.pointsTotal}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Proxy     : ${proxyStatus}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}PING      : ${pingStatus}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}TIME RUN  : ${elapsedTime}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Websocket : ${websocketStatus}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}FOLLOW TG: @AirdropJP_JawaPride\x1b[0m`); 
    console.log(`------------------------------------`);
  });

  currentColorIndex = (currentColorIndex + 1) % colors.length;
}

function startBlinkingColorMessage() {
  setInterval(updateDisplay, 1000);
}

async function getUserId(email, password) {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
  const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

  console.log(`Attempting to log in with email: ${email}`);

  try {
    const response = await axios.post(loginUrl, {
      email,
      password
    }, {
      headers: {
        authorization,
        apikey,
        "Content-Type": "application/json"
      }
    });

    if (response.data && response.data.user) {
      console.log(`User ID: ${response.data.user.id}`);
      return response.data.user.id;
    } else {
      console.error("User not found.");
      return null;
    }
  } catch (error) {
    console.error("Error during login:", error.response ? error.response.data : error.message);
    return null;
  }
}

async function main() {
  const accounts = await readJsonFile('akun.json');
  const proxies = await readJsonFile('proxy.json');

  startTime = new Date();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = proxies[i]; // Menggunakan proxy yang sama dengan indeks akun

    const userId = await getUserId(account.email, account.password);

    if (userId) {
      accountsData.push({ ...account, proxy, userId });
      connectWebSocket(userId, account.email, proxy);
    }
  }
}

main();
