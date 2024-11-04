const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const colors = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m']; // Misalnya, definisikan beberapa warna

let sockets = []; // Menggunakan array untuk menyimpan semua socket
let pingIntervals = []; // Array untuk menyimpan interval PING

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

async function connectWebSocket(userId, proxy, account, accountIndex) {
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
  const wsOptions = { agent };

  const socket = new WebSocket(wsUrl, wsOptions);
  sockets.push(socket); // Menyimpan socket ke dalam array

  socket.onopen = () => {
    console.log(`WebSocket connected for account ${accountIndex + 1} (User ID: ${userId})`);
    startPing(socket, accountIndex); // Mulai mengirim PING setelah koneksi terbuka

    // Mendapatkan waktu saat ini
    const currentTime = new Date().toLocaleString();
    // Contoh status proxy dan ping (ubah sesuai logika Anda)
    const proxyStatus = proxy ? 'Aktif' : 'Tidak Aktif';
    const pingStatus = 'Aktif'; // Anda bisa menambahkan logika untuk memeriksa status ping
    const elapsedTime = '0'; // Hitung waktu yang telah berlalu jika diperlukan
    const websocketStatus = 'Terhubung';

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(`Received message for account ${accountIndex + 1}:`, data);
      
      // Update the display values for points
      account.pointsToday = data.pointsToday; // Update the account object
      account.pointsTotal = data.pointsTotal; // Update the account object
      
      // Re-display the account status with updated points
      displayAccountStatus(account, accountIndex, proxy); // Pass proxy status here
    };
  };

  socket.onclose = () => {
    console.log(`WebSocket disconnected for account ${accountIndex + 1}`);
    removeSocket(socket); // Menghapus socket dari array
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for account ${accountIndex + 1}:`, error);
  };
}

function displayAccountStatus(account, accountIndex, proxy) { // Add proxy parameter here
  const currentColorIndex = accountIndex % colors.length;
  console.log(`---------------------------------`);
  console.log(`${colors[currentColorIndex]}AKUN ${accountIndex + 1}: ${account.email}\x1b[0m`);
  console.log(`${colors[currentColorIndex]}DATE/JAM  : ${new Date().toLocaleString()}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Poin DAILY: ${account.pointsToday || 'Tidak Ada'}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Total Poin: ${account.pointsTotal || 'Tidak Ada'}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Proxy     : ${proxy ? 'Aktif' : 'Tidak Aktif'}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}PING      : Aktif\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}TIME RUN  : 0\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Websocket : Terhubung\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}TELEGRAM  : @AirdropJP_JawaPride\x1b[0m`); 
  console.log(`---------------------------------`);
}

function startPing(socket, accountIndex) {
  const pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'PING' })); // Mengirim PING
      console.log(`PING sent to account ${accountIndex + 1}`);
    }
  }, 5000); // Kirim PING setiap 5 detik
  pingIntervals.push(pingInterval); // Simpan interval PING
}

function removeSocket(socket) {
  const index = sockets.indexOf(socket);
  if (index > -1) {
    sockets.splice(index, 1);
    clearInterval(pingIntervals[index]); // Hentikan interval PING jika socket terputus
    pingIntervals.splice(index, 1); // Hapus interval dari array
  }
}

async function getUserId(account, index) {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
  const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

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
      await connectWebSocket(userId, proxy, account, i);
    } else {
      console.error(`Failed to retrieve user ID for account ${i + 1}.`);
    }
  }
}

main().catch(console.error);
