FROM node:20-slim

# Install build essentials for SQLite3 native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application source code
COPY . .

RUN chmod +x docker_config/docker-entrypoint.sh

# ENTRYPOINT ["docker_config/docker-entrypoint.sh"]
# CMD ["npm", "start"]
# RUN npm run dev
