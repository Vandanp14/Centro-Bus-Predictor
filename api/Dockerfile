FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ src/
EXPOSE 5001
CMD ["gunicorn", "src.wsgi:app", "--bind", "0.0.0.0:5001", "--workers", "2", "--access-logfile", "-", "--error-logfile", "-"]
