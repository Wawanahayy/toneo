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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

let totalPoints = 0;
let pointsToday = 0;

// Daftar kode warna ANSI
const colors = [
  '\x1b[31m', // Merah
  '\x1b[32m', // Hijau
  '\x1b[33m', // Kuning
  '\x1b[34m', // Biru
  '\x1b[35m', // Magenta
  '\x1b[36m'  // Cyan
];

function kedipKedipPesan(pesan, duration) {
  let colorIndex = 0;
  const blinkInterval = setInterval(() => {
    process.stdout.write(`\x1b[5m${colors[colorIndex % colors.length]}${pesan}\x1b[0m\r`);
    colorIndex++;
  }, 200); // Ganti warna setiap 0.2 detik

  setTimeout(() => {
    clearInterval(blinkInterval);
    console.log('\x1b[0m'); // Reset warna dan gaya teks setelah 10 detik
  }, duration);
}

async function ambilPoinPengguna(userId) {
  try {
    const { data, error } = await supabase
      .from('user_points')
      .select('total_poin, poin_UPDATE')
      .eq('id_pengguna', userId)
      .single();

    if (error) throw error;

    return data || { total_poin: 0, poin_hari_ini: 0 };
  } catch (error) {
    console.error(chalk.red('Gagal mengambil poin pengguna:'), error.message);
    return { total_poin: 0, poin_hari_ini: 0 };
  }
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
    if (parsedData.pointsTotal !== undefined) {
      totalPoints = parsedData.pointsTotal;
      pointsToday = parsedData.pointsToday;
    }
  });

  socket.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error);
  });

  socket.on('close', (code, reason) => {
    console.log(chalk.red('WebSocket ditutup:'), code, reason);
    setTimeout(() => {
      buatKoneksiWebSocket(userId, tokenAkses);
    }, 10000); // Coba sambung kembali setelah 10 detik
  });

  return socket;
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
    console.log(chalk.green('Token Akses berhasil'));

    supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    const poinPengguna = await ambilPoinPengguna(data.user.id);
    totalPoints = poinPengguna.total_poin;
    const socket = buatKoneksiWebSocket(data.user.id, session.access_token);

    // Print pembaruan poin berkedip setiap 10 detik
    setInterval(() => {
      const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
      const pesan = `POINT UPDATE | TOTAL POINT DAILY: ${pointsToday} | TOTAL POINT: ${totalPoints} | JAM: ${timestamp}`;
      kedipKedipPesan(pesan, 10000); // Berkedip selama 10 detik
    }, 10000); // 10000 ms = 10 detik

    // Cek status WebSocket setiap 5 menit
    setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        console.log(chalk.green('WebSocket masih terhubung'));
      } else {
        console.log(chalk.red('WebSocket tidak terhubung'));
      }
    }, 300000); // 300000 ms = 5 menit

 
    setInterval(async () => {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error(chalk.red('Error memperbarui sesi:'), refreshError);
      } else {
        console.log(chalk.green('Sesi diperbarui. Token akses berhasil'));
        supabase.auth.setSession(refreshData.session);
      }
    }, 950000); t

  } catch (error) {
    console.error(chalk.red('Kesalahan:'), error.message);
  }
}

jalankanProgram();
