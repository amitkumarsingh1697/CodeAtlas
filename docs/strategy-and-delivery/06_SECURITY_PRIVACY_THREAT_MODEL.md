# Security, Privacy & Threat Model

## 1. Security promise
Default core analysis runs locally. Do not claim “nothing ever leaves the machine” until network traffic, update checks, licence checks, telemetry, crash reports, AI providers and all dependencies have been tested and documented.

## 2. Threat actors and assets
Threats: malicious repository content, compromised dependencies, malicious plugins, local malware, accidental secret exposure, unauthorized local API access, report leakage, unsafe path traversal, archive bombs, denial of service, supply-chain compromise and insider misuse in future team deployments.

Assets: source code, secrets, graph metadata, file paths, reports, credentials, licence keys, customer identity, audit records.

## 3. Required controls
- Least-privilege filesystem access.
- Canonical path validation and symlink protections.
- File-size, recursion, archive and resource limits.
- Secret detection and redaction before persistence/export/logging.
- No arbitrary shell execution from repository metadata.
- No execution of project build scripts by default.
- Safe parser isolation where practical.
- Loopback-only local API by default.
- Short-lived scoped API tokens.
- CSRF/origin protections as applicable.
- Dependency pinning, vulnerability scanning and SBOM.
- Signed releases and verified update mechanism.
- Secure temporary file handling.
- Encrypted transport for remote deployment.
- At-rest encryption where deployment architecture requires it.
- Role-based access, audit and SSO for enterprise.
- Customer-controlled retention and deletion.

## 4. Network and AI policy
Core static analysis must work without an external LLM. Any optional AI feature must:
- Be off by default until user enables it.
- Identify provider and endpoint.
- Show what context will be sent.
- Minimize and redact payloads.
- Support customer-approved endpoint/configuration where feasible.
- Avoid provider training on customer data unless separately consented and contractually agreed.
- Log metadata, not source content.
- Provide a no-AI alternative.

## 5. Threat-model exercises
- Malicious repository contains symlink to sensitive directory.
- Malicious package/build script attempts execution.
- Oversized or deeply nested source/archive causes resource exhaustion.
- Secret embedded in config is included in report.
- Local API is accessed by another local process/site.
- MCP client requests unrestricted file content.
- Report contains sensitive absolute paths or credentials.
- Update or dependency is compromised.

## 6. Required evidence before production release
- Data-flow diagram.
- Threat model with risk owners.
- SAST, dependency and secret scanning.
- DAST/API tests for networked components.
- Fuzz or robustness tests for parsers/path handling where appropriate.
- SBOM.
- Signed release artifact.
- Independent penetration test for hosted/enterprise network surfaces before broad enterprise claims.
- Incident response and vulnerability disclosure process.
- Backup/restore and deletion verification for any central service.

## 7. Compliance language
Do not claim SOC 2, ISO 27001, GDPR compliance, HIPAA compliance or “certified secure” without legal and independent assurance. You may accurately describe implemented controls and current audit status.
