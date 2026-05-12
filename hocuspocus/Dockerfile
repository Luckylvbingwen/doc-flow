FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json index.ts ./
RUN npm install && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package.json /app/index.js ./
RUN npm install --omit=dev
EXPOSE 1234
CMD ["node", "index.js"]
