async function getUserId() {
  exec("curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing display.sh: ${error.message}`);
      logMessage(`Error executing display.sh: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Error: ${stderr}`);
      logMessage(`Error: ${stderr}`);
      return;
    }
    console.log(stdout);
    logMessage(`Display script output: ${stdout}`);

    // Pertanyaan untuk memasukkan email
    rl.question('Masukkan email: ', (email) => {
      console.log(`Email yang dimasukkan: ${email}`); // Tampilkan email yang dimasukkan
      logMessage(`Email yang dimasukkan: ${email}`); // Simpan email ke log

      const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
      const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5LnN1cGFibGUuY29yZSIsImlhdCI6MTY5MjM4NTE2MywiZXhwIjoxOTQ3NTQ1MTYzfQ.m0uHuyjGH_w27fyB_q9xV1SyHMIeRCPwX9ZhZc-AN0I";
      const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

      rl.question('Masukkan User ID: ', async (userId) => {
        try {
          const profileUrl = `https://ikknngrgxuxgjhplbpey.supabase.co/rest/v1/profiles?user_id=eq.${userId}`;
          const profileResponse = await axios.get(profileUrl, {
            headers: {
              'Authorization': authorization,
              'apikey': apikey
            }
          });

          const personalCode = profileResponse.data[0].personal_code;
          console.log('Personal Code:', personalCode);
          await logMessage(`Personal Code: ${personalCode}`);

          await connectWebSocket(userId);
        } catch (error) {
          console.error('Error during login:', error);
          await logMessage(`Error during login: ${error}`);
        }
      });
    });
  });
}
