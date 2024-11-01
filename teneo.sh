#!/bin/bash


echo "Menjalankan tampilan..."
curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash


read -p "Masukkan SUPABASE_KEY: " SUPABASE_KEY
read -p "Masukkan SUPABASE_USER_EMAIL: " SUPABASE_USER_EMAIL
read -sp "Masukkan SUPABASE_USER_PASSWORD: " SUPABASE_USER_PASSWORD
echo

# Menyimpan ke file .env
echo "SUPABASE_URL=https://ikknngrgxuxgjhplbpey.supabase.co" > .env
echo "SUPABASE_USER_EMAIL=${SUPABASE_USER_EMAIL}" >> .env
echo "SUPABASE_USER_PASSWORD=${SUPABASE_USER_PASSWORD}" >> .env

# Instalasi dependensi
echo "Menginstal dependensi..."
npm install dotenv
npm install chalk@4
npm install ws
npm install axios

# Menjalankan run.js
node run.js
