FROM node:18-alpine

# Install Tesseract OCR
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create necessary directories
RUN mkdir -p uploads certificates

EXPOSE 3011

CMD ["npm", "start"]
