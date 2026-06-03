FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir pip --upgrade
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8098
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8098"]
