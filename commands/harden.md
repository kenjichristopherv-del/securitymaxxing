---
description: Review deployment and infrastructure config — Docker, Kubernetes, Terraform, cloud IAM, and logging readiness.
argument-hint: "[infra path or platform] (optional)"
allowed-tools: Read, Grep, Glob, Bash(rg:*), Bash(find:*), Bash(ls:*), Bash(git ls-files:*)
---

# Infrastructure and deployment hardening

The application can be perfect and still be breached through how it's deployed. **Read-only** —
report, don't apply.

Scope: $ARGUMENTS

Find the relevant files: `Dockerfile*`, `docker-compose*`, `*.tf`, `k8s/`/`*.yaml` manifests,
Helm charts, `serverless.yml`, `.github/workflows/`, `Procfile`, `fly.toml`, `vercel.json`,
`nginx.conf`/`Caddyfile`, systemd units, and any deploy script.

## 1. Containers

- **Running as root.** Is there a `USER` directive with a non-root UID? Default is root.
- Base image: pinned by digest or by a mutable tag? Is it a slim/distroless variant, or a full
  OS with a package manager and shell the attacker can use?
- Build secrets: `ARG`/`ENV` secrets persist in image layers even if later unset. Look for
  `--mount=type=secret` or a multi-stage build instead.
- Is the final image built from a multi-stage build, or does it ship build tools, source, `.git`,
  and dev dependencies?
- `.dockerignore` — does the build context include `.env`, `.git`, or credentials?
- Runtime flags: `--privileged`, `--cap-add=SYS_ADMIN`/`NET_ADMIN`, host network mode, the
  Docker socket mounted into a container (that's root on the host — always a finding).
- Volume mounts: is the host filesystem mounted more broadly than needed, and writable?
- Read-only root filesystem, dropped capabilities, `no-new-privileges`, seccomp/AppArmor profile.
- Resource limits — an unbounded container is a host-wide DoS.

## 2. Kubernetes

- Pod security: `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`,
  dropped capabilities, no `hostPID`/`hostNetwork`/`hostPath`.
- RBAC: any `ClusterRole` with `*` verbs or resources; service accounts bound more broadly
  than needed; the default service account token auto-mounted into pods that don't need it.
- Secrets: base64 in a manifest is **not encryption**. Is there sealed-secrets/external-secrets,
  and is etcd encryption at rest enabled?
- NetworkPolicies — without them, every pod can reach every other pod. Default-deny in place?
- Ingress: TLS configured, admin/internal services not exposed publicly.
- Image pull policy and registry trust; admission control on unsigned images.

## 3. Cloud IAM and network

- **Over-broad IAM**: `"Action": "*"` / `"Resource": "*"`, `AdministratorAccess` on a service
  role, wildcard trust policies, or a role assumable by any account.
- Long-lived static access keys where a role/workload identity/OIDC federation would work.
- Public exposure: S3/GCS buckets with public read or write, public snapshots and AMIs, public
  database instances, security groups open to `0.0.0.0/0` on 22/3306/5432/6379/27017/9200.
- Default VPC/default security group usage; missing network segmentation between tiers.
- Is the metadata service protected (IMDSv2 required)? IMDSv1 turns any SSRF into cloud
  credential theft — check this specifically if the app makes outbound requests to user URLs.
- Logging: CloudTrail/audit logs enabled, in a separate account or with object-lock, and
  actually retained.
- Encryption at rest on volumes, buckets, databases, and backups.
- Are deletion protection and backups enabled on stateful resources?

## 4. Terraform / IaC

- State files: remote backend with encryption and locking, and **not committed to git** —
  state contains plaintext secrets.
- Hardcoded credentials in `.tf` files or `terraform.tfvars`.
- Modules pulled from unpinned or untrusted sources.
- Does CI run `terraform apply` with credentials that a PR from a fork could reach?

## 5. Runtime configuration

- Production config path: debug off, verbose errors off, dev/admin endpoints off, source maps
  not served, directory listing off, default credentials changed.
- Environment separation: do staging and production share databases, keys, or third-party
  accounts?
- Reverse proxy: correct `X-Forwarded-*` handling (trusted proxy list configured — otherwise
  clients spoof their IP and bypass rate limiting), request size limits, timeouts, and no
  request-smuggling-prone version.
- Are internal services (Redis, Elasticsearch, Postgres, admin panels, metrics, message
  brokers) bound to localhost/private networks with authentication enabled? Default-open
  datastores are a leading cause of mass data leaks.

## 6. Detection and response readiness

Hardening without visibility means you'll be breached quietly:

- Are authentication failures, authorization denials, admin actions, and config changes logged
  with actor, action, target, and timestamp?
- Are logs shipped somewhere the application server can't edit them?
- Is there any alerting — on error spikes, auth failure spikes, new IAM principals, egress anomalies?
- Can you revoke a key, a session, or a user immediately?
- Is there a documented on-call/incident path, and a security contact (`SECURITY.md`,
  `security.txt`) so researchers can report to you?
- Backups: exist, encrypted, off-site, and **restore-tested**. An untested backup is a hope.

## Report

Standard finding format, grouped by layer, each citing the file and line of the config. Rate by
real exposure — a permissive security group on a private subnet is not the same as one on a
public instance. Close with the three changes that reduce the most risk per unit of effort, and
note anything you could not see from the repository (live cloud state, console settings) that
should be verified directly.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- IaC/config findings → `/securitymaxxing:fix`; live-console findings are manual — name them so they aren't missed.
- Then `/securitymaxxing:ship-check` for the go/no-go.
