const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent'); // Ubah ini

let socket = null;
let startTime;

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

async function connectWebSocket(userId, proxy, accountIndex) {
  if (socket) return; // Pastikan hanya satu koneksi
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro"; // URL WebSocket
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  // Mengatur proxy di WebSocket
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

  const wsOptions = {
    agent
  };

  socket = new WebSocket(wsUrl, wsOptions);

  startTime = new Date();

  socket.onopen = () => {
    console.log(`WebSocket connected for account ${accountIndex + 1} (User ID: ${userId})`);
    fs.appendFileSync('logs.txt', `WebSocket connected for account ${accountIndex + 1} (User ID: ${userId})\n`, 'utf8');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(`Received message for account ${accountIndex + 1}:`, data);
    fs.appendFileSync('logs.txt', `Received message for account ${accountIndex + 1}: ${JSON.stringify(data)}\n`, 'utf8');
  };

  socket.onclose = () => {
    console.log(`WebSocket disconnected for account ${accountIndex + 1}`);
    fs.appendFileSync('logs.txt', `WebSocket disconnected for account ${accountIndex + 1}\n`, 'utf8');
    socket = null;
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for account ${accountIndex + 1}:`, error);
    fs.appendFileSync('logs.txt', `WebSocket error for account ${accountIndex + 1}: ${error.message}\n`, 'utf8');
  };
}

async function getUserId(account, index) {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
  const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

  const email = account.email;
  const password = account.password;

  return new Promise(async (resolve) => {
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
        console.log(`User ID for account ${index + 1}: ${response.data.user.id}`);
        fs.appendFileSync('logs.txt', `User ID for account ${index + 1}: ${response.data.user.id}\n`, 'utf8');
        resolve(response.data.user.id);
      } else {
        console.error(`User not found for account ${index + 1}.`);
        fs.appendFileSync('logs.txt', `User not found for account ${index + 1}.\n`, 'utf8');
        resolve(null);
      }
    } catch (error) {
      console.error(`Error during login for account ${index + 1}:`, error.response ? error.response.data : error.message);
      fs.appendFileSync('logs.txt', `Error during login for account ${index + 1}: ${error.response ? error.response.data : error.message}\n`, 'utf8');
      resolve(null);
    }
  });
}

async function main() {
  const accounts = await readJSONFile('akun.json');
  const proxies = await readJSONFile('proxy.json');

  if (!accounts || !proxies || accounts.length !== proxies.length) {
    console.error("Error: accounts and proxies must be present and have the same length.");
    fs.appendFileSync('logs.txt', "Error: accounts and proxies must be present and have the same length.\n", 'utf8');
    return;
  }

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = proxies[i];
    const userId = await getUserId(account, i);
    
    if (userId) {
      await connectWebSocket(userId, proxy, i); // Hanya sambungkan WebSocket jika userId valid
    } else {
      console.error(`Failed to retrieve user ID for account ${i + 1}.`);
      fs.appendFileSync('logs.txt', `Failed to retrieve user ID for account ${i + 1}.\n`, 'utf8');
    }
  }
}

main().catch(console.error);
