#!/bin/bash/

 cp -R /home/ubuntu/neotrade-test/public /home/ubuntu/neotrade-platform/services/frontend/
# Copy your current App.jsx
cp /home/ubuntu/neotrade-test/src/App.jsx /home/ubuntu/neotrade-platform/services/frontend/src/App.jsx

# Copy index.css
cp /home/ubuntu/neotrade-test/src/index.css /home/ubuntu/neotrade-platform/services/frontend/src/index.css

# Copy main.jsx
cp /home/ubuntu/neotrade-test/src/main.jsx /home/ubuntu/neotrade-platform/services/frontend/src/main.jsx

# Copy other configs
cp /home/ubuntu/neotrade-test/package.json /home/ubuntu/neotrade-platform/services/frontend/package.json
cp /home/ubuntu/neotrade-test/vite.config.js /home/ubuntu/neotrade-platform/services/frontend/vite.config.js
cp /home/ubuntu/neotrade-test/postcss.config.cjs /home/ubuntu/neotrade-platform/services/frontend/postcss.config.cjs
cp /home/ubuntu/neotrade-test/Dockerfile /home/ubuntu/neotrade-platform/services/frontend/Dockerfile
cp /home/ubuntu/neotrade-test/nginx.conf /home/ubuntu/neotrade-platform/services/frontend/nginx.con



echo "copy done"
