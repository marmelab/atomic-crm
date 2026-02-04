FROM node:24-alpine
ARG FRONTEND_HTTP_HOST=5173
ARG FRONTEND_HMR_PORT=5174
USER node
WORKDIR /app
COPY ../package.json ../package-lock.json ./
RUN npm install --no-save
EXPOSE ${FRONTEND_HTTP_HOST}
EXPOSE ${FRONTEND_HMR_PORT}
