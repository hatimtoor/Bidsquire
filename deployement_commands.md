Step 1: SSH into the server
ssh administrator@108.181.167.171
Password: BqSrv!2026#Atif#9XqL

Step 2: Navigate to the project folder
cd ~/bidsquire/ebay_project/project

Step 3: Pull the latest code
git pull origin main

Step 4: Install dependencies and build
npm install --legacy-peer-deps
npm run build

Step 5: Restart the PM2 process
First check the PM2 process name:

pm2 list

Then restart it (replace <process-name> with the actual name from pm2 list):


pm2 restart <process-name>    ( e.g: pm2 restart ebay-dev)