const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const { exec } = require('child_process');

let socket = null;
let pingInterval;
let countdownInterval;
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;

function displayHeader() {
  exec("curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing display.sh: ${error}`);
      return;
    }
    console.log(stdout);
  });
}

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi lainnya...
async function getLocalStorage() {
  try {
    const data = await readFileAsync('localStorage.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
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
    const connectionTime = new Date().toISOString();
    await setLocalStorage({ lastUpdated: connectionTime });
    console.log("WebSocket connected at", connectionTime);
    startPinging();
    startCountdownAndPoints();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("Received message from WebSocket:", data);
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

// Menempatkan authorization dan apikey di sini
const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGV5Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

async function initialize() {
  // Menampilkan header sebelum melanjutkan
  displayHeader();

  const localStorageData = await getLocalStorage();
  console.log("Local Storage Data:", localStorageData);

  const userId = localStorageData.userId || await new Promise((resolve) => {
    rl.question('Please enter your User ID: ', (answer) => {
      resolve(answer);
    });
  });

  const proxy = localStorageData.proxy || await new Promise((resolve) => {
    rl.question('Please enter your proxy (or leave blank): ', (answer) => {
      resolve(answer);
    });
  });

  await connectWebSocket(userId, proxy);
}

initialize();
