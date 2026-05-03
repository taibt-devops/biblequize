# Deploy to Production

Build BE + FE Docker images, push to Docker Hub, SSH to server và deploy.

## Steps

Run the following bash commands in sequence. Stop and report error if any step fails.

### 1. Get current git commit hash
```bash
COMMIT=$(git rev-parse --short HEAD)
echo "Deploying commit: $COMMIT"
```

### 2. Build BE image
```bash
docker build \
  -t taibt2docker/biblequiz-be:latest \
  -t taibt2docker/biblequiz-be:$COMMIT \
  -f apps/api/Dockerfile \
  apps/api/
```

### 3. Build FE image (from project root, uses .dockerignore)
```bash
docker build \
  -t taibt2docker/biblequiz-fe:latest \
  -t taibt2docker/biblequiz-fe:$COMMIT \
  -f infra/docker/web.Dockerfile \
  .
```

### 4. Push BE image
```bash
docker push taibt2docker/biblequiz-be:latest
docker push taibt2docker/biblequiz-be:$COMMIT
```

### 5. Push FE image
```bash
docker push taibt2docker/biblequiz-fe:latest
docker push taibt2docker/biblequiz-fe:$COMMIT
```

### 6. SSH to server and deploy
```bash
ssh -o StrictHostKeyChecking=no ubuntu@52.194.243.39 \
  "cd /opt/biblequiz && docker compose pull api web && docker compose up -d --no-deps --force-recreate api web"
```

### 7. Verify containers are running
```bash
ssh -o StrictHostKeyChecking=no ubuntu@52.194.243.39 \
  "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

Report the final container status to the user.
