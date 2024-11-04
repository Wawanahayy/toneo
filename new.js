const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

let sockets = []; // Menggunakan array untuk menyimpan semua socket
let pingIntervals = []; // Array untuk menyimpan interval PING
let elapsedTimes = []; // Array untuk menyimpan waktu berjalan
let colors = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m', '\x1b[36m']; // Warna untuk log
let currentColorIndex = 0; // Indeks warna saat ini

const readFileAsync = promisify(fs.readFile);

async function readJSONFile(filePath) {
  try {
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

async function connectWebSocket(userId, proxy, accountIndex, account) {
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
  const wsOptions = { agent };

  const socket = new WebSocket(wsUrl, wsOptions);
  sockets.push(socket); // Menyimpan socket ke dalam array
  elapsedTimes[accountIndex] = 0; // Inisialisasi waktu berjalan

  socket.onopen = () => {
    console.log(`WebSocket connected for account ${accountIndex + 1} (User ID: ${userId})`);
    startPing(socket, accountIndex); // Mulai mengirim PING setelah koneksi terbuka
    startTimer(accountIndex); // Mulai timer
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.pointsToday !== undefined && data.pointsTotal !== undefined) {
      account.pointsToday = data.pointsToday; // Update poin harian
      account.pointsTotal = data.pointsTotal; // Update total poin
    }
    logAccountStatus(account, accountIndex);
  };

  socket.onclose = () => {
    console.log(`WebSocket disconnected for account ${accountIndex + 1}`);
    removeSocket(socket); // Menghapus socket dari array
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for account ${accountIndex + 1}:`, error);
  };
}

function startPing(socket, accountIndex) {
  const pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'PING' })); // Mengirim PING
      // Hapus atau komentari baris berikut untuk tidak menampilkan log PING
      // console.log(`PING sent to account ${accountIndex + 1}`);
    }
  }, 5000); // Kirim PING setiap 5 detik
  pingIntervals.push(pingInterval); // Simpan interval PING
}

function startTimer(accountIndex) {
  const timerInterval = setInterval(() => {
    elapsedTimes[accountIndex]++; // Tambahkan detik ke waktu berjalan
  }, 1000); // Setiap detik
}

function removeSocket(socket) {
  const index = sockets.indexOf(socket);
  if (index > -1) {
    sockets.splice(index, 1);
    clearInterval(pingIntervals[index]); // Hentikan interval PING jika socket terputus
    pingIntervals.splice(index, 1); // Hapus interval dari array
    clearInterval(elapsedTimes[index]); // Hentikan timer jika socket terputus
    elapsedTimes.splice(index, 1); // Hapus waktu dari array
  }
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

function logAccountStatus(account, index) {
  const currentTime = new Date().toLocaleString();
  const proxyStatus = "Aktif"; // Ganti dengan logika untuk memeriksa status proxy
  const pingStatus = "Aktif"; // Ganti dengan logika untuk memeriksa status PING
  const elapsedTime = elapsedTimes[index]; // Waktu berjalan dalam detik
  const websocketStatus = "Terhubung"; // Ganti dengan logika untuk memeriksa status WebSocket

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
}

async function main() {
  const accounts = await readJSONFile('akun.json');
  const proxies = await readJSONFile('proxy.json');

  if (!accounts || !proxies || accounts.length !== proxies.length) {
    console.error("Error: accounts and proxies must be present and have the same length.");
    return;
  }

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = proxies[i];
    const userId = await getUserId(account, i);
    
    if (userId) {
      await connectWebSocket(userId, proxy, i, account);
    } else {
      console.error(`Failed to retrieve user ID for account ${i + 1}.`);
    }
  }
}

main().catch((error) => console.error("Error in main:", error));
