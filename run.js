require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { exec } = require('child_process');
const chalk = require('chalk');

exec("curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash", (error, stdout, stderr) => {
  if (error) {
    console.error(chalk.red(`Kesalahan saat menjalankan display.sh: ${error.message}`));
    return;
  }
  if (stderr) {
    console.error(chalk.red(`Kesalahan: ${stderr}`));
    return;
  }
  console.log(stdout);
});

console.log(chalk.blue('SUPABASE_URL:'), chalk.green(process.env.SUPABASE_URL));
console.log(chalk.blue('SUPABASE_KEY (10 karakter pertama):'), chalk.green(process.env.SUPABASE_KEY.substring(0, 10)));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Array warna
const colors = [chalk.red, chalk.green, chalk.yellow, chalk.blue, chalk.magenta, chalk.cyan];
let colorIndex = 0; // Indeks warna untuk digunakan
let currentColor = chalk.white; // Warna saat ini untuk menampilkan

// Variabel untuk menyimpan total poin
let totalPoints = 0;
let pointsToday = 0; // Menyimpan poin hari ini
let colorInterval;

function getNextColor() {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length; // Ganti indeks warna
  return color;
}

function ambilPoinDariData(parsedData) {
  pointsToday = parsedData.pointsToday; // Update poin hari ini
  totalPoints = parsedData.pointsTotal; // Update total poin
}

function formatTimestamp(date) {
  const options = {
    timeZone: 'Asia/Jakarta', // Mengatur zona waktu ke GMT+7
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('id-ID', options).format(date).replace(',', ''); // Format timestamp
}

function buatKoneksiWebSocket(userId, tokenAkses) {
  const wsUrl = `wss://secure.ws.teneo.pro/websocket?userId=${encodeURIComponent(userId)}&version=v0.2`;
  const socket = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${tokenAkses}` }
  });

  socket.on('open', () => {
    console.log(chalk.green('WebSocket terhubung'));
    socket.send(JSON.stringify({ type: "KONEKSI" }));
  });

  socket.on('message', (data) => {
    const parsedData = JSON.parse(data.toString());
    ambilPoinDariData(parsedData); // Ambil poin dari data WebSocket

    const jam = formatTimestamp(new Date()); // Ambil timestamp saat ini
    // Update tampilan total poin dengan jam
    process.stdout.write(`\r${currentColor(`POINT UPDATE | TOTAL POINT DAILY: ${pointsToday} | POINT UPDATE: ${pointsToday} | ALL POINT: ${totalPoints} | JAM: ${jam}`)}`);
  });

  socket.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error);
  });

  socket.on('close', (code, reason) => {
    console.log(chalk.red('WebSocket ditutup:'), code, reason);
  });

  return socket;
}

function startColorChange() {
  colorInterval = setInterval(() => {
    currentColor = getNextColor();
    // Menampilkan total poin dengan warna yang berubah
    const jam = formatTimestamp(new Date()); // Ambil timestamp saat ini
    process.stdout.write(`\r${currentColor(`POINT UPDATE | TOTAL POINT DAILY: ${pointsToday} | POINT UPDATE: ${pointsToday} | ALL POINT: ${totalPoints} | JAM: ${jam}`)}`);
  }, 200); // Mengubah warna setiap 200ms

  // Cetak setiap 1 jam
  setInterval(() => {
    const jam = formatTimestamp(new Date()); // Ambil timestamp saat ini
    console.log(currentColor(`POINT UPDATE | TOTAL POINT DAILY: ${pointsToday} | POINT UPDATE: ${pointsToday} | ALL POINT: ${totalPoints} | DATE: ${jam}`));
  }, 3600000); // Mengatur interval untuk mencetak setiap 1 jam
}

async function jalankanProgram() {
  try {
    console.log(chalk.blue('Menggunakan token akses untuk autentikasi...'));

    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.SUPABASE_USER_EMAIL,
      password: process.env.SUPABASE_USER_PASSWORD,
    });

    if (error) throw error;

    const session = data.session;
    console.log(chalk.green('Autentikasi berhasil'));
    console.log(chalk.green('Token Akses:'), session.access_token);
    console.log(chalk.green('Token Penyegaran:'), session.refresh_token);

    supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    // Mulai koneksi WebSocket
    const socket = buatKoneksiWebSocket(data.user.id, session.access_token);
    
    // Menjalankan interval untuk memperbarui sesi
    setInterval(async () => {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error(chalk.red('Error memperbarui sesi:'), refreshError);
      } else {
        console.log(chalk.green('Sesi diperbarui. Token akses baru:'), refreshData.session.access_token);
        supabase.auth.setSession(refreshData.session);
      }
    }, 3000000);

  } catch (error) {
    console.error(chalk.red('Kesalahan:'), error.message);
  }
}

// Mulai interval warna saat program dijalankan
startColorChange();
jalankanProgram();
