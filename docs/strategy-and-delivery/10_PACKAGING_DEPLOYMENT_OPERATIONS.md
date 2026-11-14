# Packaging, Deployment & Operations

## Deployment sequence
### Local CLI — first
- Install from signed release or verified package.
- User explicitly selects repository and exclusions.
- Core scan runs offline.
- Local API binds to loopback.
- Results and reports remain on customer machine.
- Uninstall and data deletion documented.

### Customer-controlled private cloud — second
- Deploy into customer-owned account/VPC.
- Customer controls repository checkout and credentials.
- Private network and egress policy documented.
- Secrets manager integration.
- Encryption and access controls.
- Audit events and retention policy.
- Infrastructure-as-code and upgrade/rollback procedure.

### On-premises / air-gapped — only when justified
- Signed offline installation bundle.
- Offline licence/activation strategy reviewed.
- Dependency and update process documented.
- Customer-controlled backup and recovery.
- No undocumented external dependencies.

### Hosted SaaS — later
Only after customer demand and security/legal architecture justify it. Require tenant isolation, secure ingestion, encryption, deletion, audit, incident response, privacy policy and contractual controls.

## Release artifacts
- macOS, Linux and Windows packages only for tested platforms.
- Checksums and signatures.
- SBOM.
- Release notes and known issues.
- Install/upgrade/uninstall docs.
- Support diagnostics with redaction.
- Rollback instructions.

## Operations
- Versioned database migrations.
- Health checks.
- Structured logs with no source contents.
- Crash reporting opt-in and redacted.
- Backup/restore tests for persistent services.
- Vulnerability reporting and patch SLA.
- Dependency update policy.
- Support severity definitions.
