FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV MQTT_URL=mqtt://mosquitto:1883

EXPOSE 3000

CMD ["node", "listener.js"]
