# Deploy to Production

Build BE + FE Docker images, push to Docker Hub, SSH to the prod host and recreate the containers.

**Prod runs on cura-dev** (on-prem PC), not on EC2 any more (2026-10-08):
`https://forbible.org` → mcc-bastion `57.180.119.77` (nginx) → `127.0.0.1:3130` web / `3131` api
→ reverse tunnel `ssh-forbible.service` on cura-dev. Compose: `/home/cura/projects/biblequiz/compose.yml`.
SSH path: `ssh -J ec2-user@57.180.119.77,root@localhost:2222 cura@192.168.100.162` (key auth; `2222` = meta).

## Steps

Run the following commands in sequence. Stop and report error if any step fails.
Build from a clean `git worktree` at `origin/main` — the main tree often has uncommitted edits that would leak into the images.

### 1. Get current git commit hash
```bash
COMMIT=$(git rev-parse --short HEAD)
echo "Deploying commit: $COMMIT"
git diff --stat <last-deployed-commit>..HEAD -- apps/api   # empty = BE unchanged → deploy web only
```

### 2. Build BE image (skip when apps/api is unchanged)
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

### 4. Push the images you built
```bash
docker push taibt2docker/biblequiz-be:$COMMIT && docker push taibt2docker/biblequiz-be:latest
docker push taibt2docker/biblequiz-fe:$COMMIT && docker push taibt2docker/biblequiz-fe:latest
```

### 5. Note the running digests (rollback), then deploy on cura-dev
```bash
SSH="ssh -o BatchMode=yes -J ec2-user@57.180.119.77,root@localhost:2222 cura@192.168.100.162"
$SSH "docker image inspect taibt2docker/biblequiz-fe:latest taibt2docker/biblequiz-be:latest --format '{{index .RepoDigests 0}}'"
$SSH "cd /home/cura/projects/biblequiz && docker compose pull web && docker compose up -d --no-deps --force-recreate web"
# add `api` to both commands when the BE image was rebuilt
```
From PowerShell, multi-line remote scripts lose their quotes — base64-encode the script and run `echo <b64> | base64 -d | bash` on the far side.

### 6. Verify
```bash
$SSH "docker ps --filter name=biblequiz --format '{{.Names}} | {{.Status}}'; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3130/"
curl -s -o /dev/null -w "%{http_code}\n" https://forbible.org/
```

Rollback: `image: taibt2docker/biblequiz-fe@sha256:<previous digest>` (or retag that digest as `latest`) and recreate the service.

Report the final container status to the user.
