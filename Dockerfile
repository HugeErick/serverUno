FROM node:21-alpine
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

COPY . ./
EXPOSE 4000
CMD ["node", "server.js"]
