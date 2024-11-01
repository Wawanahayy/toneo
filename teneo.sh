#!/bin/bash

echo "Menjalankan tampilan..."
curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash


echo "WELCOME TO SCRIPT WITH JAWAPRIDE_ID"
echo "{ 1 to continue 2 to stop }"
read -p "Please choose an option (1 or 2): " option

if [ "$option" -eq 2 ]; then
    echo "Please join the channel first:"
    echo "SILAHKAN JOIN terlebih dahulu: https://t.me/AirdropJP_JawaPride"
    echo "TG: @AirdropJP_JawaPride"
    exit 0
fi


# Install dependencies
echo "Installing dependencies..."
npm install dotenv
npm install chalk@4
npm install ws
npm install axios

# Run run.js
node run.js
