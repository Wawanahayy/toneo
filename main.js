const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const WebSocket = require('ws');
const { promisify } = require('util');
const HttpsProxyAgent = require('https-proxy-agent');

let socket = null;
let pingInterval;
let countdownInterval;
let accountsData = []; // Menyimpan data akun di sini
let currentColorIndex = 0;
const colors = ['\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m']; // Warna untuk log

const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

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
    console.error("Error reading localStorage.json:", error);
    return {};
  }
}

async function setLocalStorage(data) {
  const currentData = await getLocalStorage();
  const newData = { ...currentData, ...data };
  await writeFileAsync('localStorage.json', JSON.stringify(newData));
}

async function connectWebSocket(userId, proxy) {
  if (socket) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  const options = {};
  if (proxy) {
    options.agent = new HttpsProxyAgent(proxy);
  }

  socket = new WebSocket(wsUrl, options);

  socket.onopen = async () => {
    console.log("WebSocket connected");
    startPinging();
    startBlinkingColorMessage();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("Received message from WebSocket:", data);
    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      const account = accountsData.find(acc => acc.userId === data.userId);
      if (account) {
        account.pointsTotal = data.pointsTotal;
        account.pointsToday = data.pointsToday;
      }
    }
  };

  socket.onclose = (event) => {
    console.log("WebSocket disconnected", event.code, event.reason);
    socket = null;
    stopPinging();
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

function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

let startTime = null; // Menyimpan waktu mulai

function calculateElapsedTime() {
  if (!startTime) return '0m 0s';
  const elapsed = new Date() - startTime;
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
  return `${minutes}m ${seconds}s`;
}

function updateDisplay() {
  const currentTime = formatDate(new Date());
  const elapsedTime = calculateElapsedTime();

  console.clear();

  accountsData.forEach((account, index) => {
    const websocketStatus = account.socket && account.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected';
    const proxyStatus = account.proxy ? 'true' : 'false';
    const pingStatus = account.pingStatus || 'Inactive';

    console.log(`---------------------------------`);
    console.log(`${colors[currentColorIndex]}AKUN ${index + 1}: ${account.email}\x1b[0m`);
    console.log(`${colors[currentColorIndex]}DATE/JAM  : ${currentTime}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Poin DAILY: ${account.pointsToday}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Total Poin: ${account.pointsTotal}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Proxy     : ${proxyStatus}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}PING      : ${pingStatus}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}TIME RUN  : ${elapsedTime}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}Websocket : ${websocketStatus}\x1b[0m`); 
    console.log(`${colors[currentColorIndex]}TELEGRAM  : @AirdropJP_JawaPride\x1b[0m`); 
    console.log(`---------------------------------`);
  });

  currentColorIndex = (currentColorIndex + 1) % colors.length;
}

function startBlinkingColorMessage() {
  setInterval(updateDisplay, 1000);
}

async function getUserId(proxy) {
  // Implementasi login dan pengambilan userId
  console.log("Implementasi login untuk mendapatkan userId akan ditempatkan di sini.");
  // Misalnya: 
  // const response = await axios.post("URL_LOGIN", { /* data login */ });
  // const userId = response.data.userId;
  // await setLocalStorage({ userId });
  // return userId;
}

async function main() {
  const localStorageData = await getLocalStorage();
  let userId = localStorageData.userId;

  console.log('Current userId:', userId); // Tambahkan log ini

  rl.question('Do you have proxy? (y/n): ', async (useProxy) => {
    let proxy = null;
    if (useProxy.toLowerCase() === 'y') {
      proxy = await new Promise((resolve) => {
        rl.question('Please enter your proxy URL (e.g., http://username:password@host:port): ', (inputProxy) => {
          resolve(inputProxy);
        });
      });
    }

    if (!userId) {
      rl.question('Menu:\n1. Login\nChoose an option: ', async (option) => {
        console.log('User chose to login'); // Tambahkan log ini
        switch (option) {
          case '1':
            await getUserId(proxy);
            break;
          default:
            console.log('Invalid option. Exiting...');
            process.exit(0);
        }
      });
    } else {
      rl.question('Menu:\n1. Logout\n2. Start Running Node\nChoose an option: ', async (option) => {
        switch (option) {
          case '1':
            fs.unlink('localStorage.json', (err) => {
              if (err) throw err;
              console.log('Logged out successfully.');
              process.exit(0);
            });
            break;
          case '2':
            startTime = new Date(); // Simpan waktu mulai saat node dijalankan
            await startBlinkingColorMessage();
            await connectWebSocket(userId, proxy);
            break;
          default:
            console.log('Invalid option. Exiting...');
            process.exit(0);
        }
      });
    }
  });
}

main();
