# Use the official Node image
FROM node:20-slim

# Set working directory to /app instead of root
WORKDIR /

# Copy dependencies files
COPY package*.json ./   

# Install only production dependencies
RUN npm install --omit=dev

# Copy app source
COPY . .

# Environment variables and build arguments
ARG PORT=3000
ENV PORT=${PORT} \
    TMDB_API_KEY=your_api_key_here \
    ALLOWED_ORIGINS='["http://localhost:3000", "https://tv.moviepluto.fun"]' \
    PRODUCTION=true

# Expose port
EXPOSE ${PORT}

# Start the app
CMD ["npm", "start"]