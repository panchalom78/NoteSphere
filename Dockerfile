# Stage 1: Build & Run Environment
FROM node:20-alpine AS base

# Install Python and SQLite
RUN apk add --no-cache python3 py3-pip sqlite-dev build-base

# Set work directory
WORKDIR /app

# Copy server files
COPY server /app/server
WORKDIR /app/server
# Set up Python virtual environment and install requirements
RUN python3 -m venv .venv && \
    .venv/bin/pip install --upgrade pip && \
    .venv/bin/pip install -r requirements.txt

# Copy client files
WORKDIR /app
COPY client /app/client
WORKDIR /app/client
# Install dependencies
RUN npm install

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start backend database init and Next.js production server
CMD ["sh", "-c", "/app/server/.venv/bin/python -c 'import server' && npm run start"]
