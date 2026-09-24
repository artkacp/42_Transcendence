FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Default production command: run Django via Daphne, an ASGI server.
# docker-compose.yml overrides this for local development with Django's runserver.
CMD ["daphne", "config.asgi:application", "-b", "0.0.0.0", "-p", "8000"]
