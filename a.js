const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const colors = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m', '\x1b[36m', '\x1b[37m']; // Warna tambahan

let sockets = [];
let pingIntervals = [];
let isFirstMessage = {};
let colorIndex = 0; // Menggunakan index warna untuk kedip
let lastPingTime;
let pingInterval = 30000; // Anda bisa membuat ini dapat diatur
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

function updateDisplay() {
  const currentTime = formatDate(new Date());
  const elapsedTime = calculateElapsedTime();

  console.clear();

  accountsData.forEach((account, index) => {
    const websocketStatus = account.socket && account.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected';
    const proxyStatus = account.proxy ? 'true' : 'false';
    const pingStatus = account.pingStatus || 'Inactive';

    console.log(colors[colorIndex] + "----------------------------------------------------------------------------------------------------------------------------------------------------------------------");
    console.log("     DETAILS YOUR ACCOUNT HERE          | DATE/JAM:   | Poin DAILY: | Total Poin: | Proxy: | PING:      | TIME RUN:   | Websocket:       |  TELEGRAM: ");
    console.log("----------------------------------------------------------------------------------------------------------------------------------------------------------------------");

    console.log(`AKUN ${index + 1}:     | ${account.email.padEnd(25)} | ${currentTime.padEnd(11)} | ${account.pointsToday.toString().padEnd(11)} | ${account.pointsTotal.toString().padEnd(12)} | ${proxyStatus.padEnd(5)} | ${pingStatus.padEnd(10)} | ${elapsedTime.padEnd(12)} | ${websocketStatus.padEnd(15)} | @AirdropJP_JawaPride` + '\x1b[0m');
  });

  console.log(colors[colorIndex] + "----------------------------------------------------------------------------------------------------------------------------------------------------------------------" + '\x1b[0m');

  // Update warna
  colorIndex = (colorIndex + 1) % colors.length;
}

function startBlinkingColorMessage() {
  setInterval(updateDisplay, 1000); // Ubah warna setiap 1 detik
}

// Sisa kode lainnya tetap sama...


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
          userId // Store the userId
        });
        await connectWebSocket(userId, account.email, account.proxy);
      } else {
        console.error(`Failed to retrieve user ID for ${account.email}. Skipping WebSocket connection.`);
      }
    } else {
      console.error("Email and password must be provided for each account.");
    }
  }
}

// Clean up on exit
process.on('SIGINT', () => {
  console.log("Cleaning up...");
  pingIntervals.forEach(clearInterval);
  sockets.forEach(socket => socket.close());
  process.exit();
});

// Start the main function
main().catch(error => console.error("Error in main function:", error));
