# Use the stable LTS version for 2026
FROM node:22-alpine
# Set to production to ensure faster performance and less logging bloat
ENV NODE_ENV=production
WORKDIR /usr/src/app
# Copy dependency manifests
COPY package*.json ./
# Clean install of production dependencies only
#RUN npm ci --only=production
RUN npm install --omit=dev
# Copy app source
COPY . .
# Cortex default port
EXPOSE 3099
# Run as a non-privileged user for security (best practice for Umbrel)
USER node
CMD [ "node", "server.js" ]