const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs').promises;
const axios = require('axios');
const readline = require('readline');

let socket = null;
let startTime;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Fungsi untuk mendapatkan user ID
async function getUserId() {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";

  // Membaca data dari account.json
  const accountData = JSON.parse(await fs.readFile('account.json', 'utf8'));
  const email = accountData.email;
  const password = accountData.password;

  try {
    const response = await axios.post(loginUrl, {
      email,
      password
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log("Response Data:", response.data); // Log respons untuk debugging
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

// Fungsi untuk membaca daftar proxy dari file proxies.json
async function getProxies() {
  try {
    const data = await fs.readFile('proxies.json', 'utf8');
    return JSON.parse(data); // Mengembalikan daftar proxy sebagai array
  } catch (error) {
    console.error("Error reading proxies file:", error.message);
    return []; // Mengembalikan array kosong jika ada kesalahan
  }
}

// Fungsi untuk menampilkan daftar proxy
async function displayProxies() {
  const proxies = await getProxies(); // Membaca daftar proxy
  if (proxies.length > 0) {
    console.log("Daftar Proxy:");
    proxies.forEach((proxy, index) => {
      console.log(`${index + 1}: ${proxy.ip}:${proxy.port}`);
    });
  } else {
    console.log("Tidak ada proxy ditemukan.");
  }
}

// Fungsi untuk menghubungkan ke WebSocket
async function connectWebSocket(userId) {
  if (socket) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
  socket = new WebSocket(wsUrl);

  startTime = new Date();

  socket.onopen = async () => {
    console.log("WebSocket connected");
    // Implementasi lebih lanjut...
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log(`Received message:`, data);
    // Implementasi lebih lanjut...
  };

  socket.onclose = () => {
    socket = null;
    console.log("WebSocket disconnected");
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

// Fungsi utama
async function main() {
  const userId = await getUserId();
  if (userId) {
    await connectWebSocket(userId);
    await displayProxies(); // Menampilkan daftar proxy setelah terhubung
  } else {
    console.error("Failed to retrieve user ID.");
  }
}

// Menjalankan fungsi utama
main().catch(console.error);
