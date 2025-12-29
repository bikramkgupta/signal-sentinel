FROM node:20-alpine

# Install debugging tools
RUN apk add --no-cache \
    curl \
    bash \
    postgresql-client \
    jq \
    openssl \
    ca-certificates

# Install kafkacat (kcat) for Kafka testing
RUN apk add --no-cache kcat

# Install AWS CLI for Spaces testing
RUN apk add --no-cache aws-cli

WORKDIR /app

# Copy test scripts
COPY test-connectivity.sh .
COPY package.json .

# Install Node.js dependencies for Kafka testing
RUN npm install

# Make scripts executable
RUN chmod +x test-connectivity.sh

# Keep container running for interactive debugging
CMD ["tail", "-f", "/dev/null"]
