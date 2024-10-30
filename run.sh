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

async function ambilPoinPengguna(userId) {
  try {
    const { data, error } = await supabase
      .from('user_points')
      .select('total_poin, poin_hari_ini')
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
    console.log(chalk.yellow('Pesan diterima:'), data.toString());
  });

  socket.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error);
  });

  socket.on('close', (code, reason) => {
    console.log(chalk.red('WebSocket ditutup:'), code, reason);
  });

  return socket;
}

function mulaiPembaruanPoin(socket, poinAwal) {
  let poin = poinAwal;
  
  setInterval(() => {
    const poinBaruHariIni = poin.poin_hari_ini + Math.floor(Math.random() * 5);
    const poinTotalBaru = poin.total_poin + (poinBaruHariIni - poin.poin_hari_ini);

    poin = { total_poin: poinTotalBaru, poin_hari_ini: poinBaruHariIni };

    console.log(chalk.cyan('POIN UPDATE:'));
    console.log(chalk.magenta('Total poin:'), poinTotalBaru);
    console.log(chalk.magenta('Poin hari ini:'), poinBaruHariIni);

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "UPDATE_POINTS",
        pointsTotal: poinTotalBaru,
        pointsToday: poinBaruHariIni
      }));
    }
  }, 60000);
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

    const poinPengguna = await ambilPoinPengguna(data.user.id);
    const socket = buatKoneksiWebSocket(data.user.id, session.access_token);
    mulaiPembaruanPoin(socket, poinPengguna);
    
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

jalankanProgram();
