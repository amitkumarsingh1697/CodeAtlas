# Release Readiness Checklist

A release is approved only for a stated version, operating system, deployment mode and supported stack.

## Product
- [ ] All P0 requirements implemented.
- [ ] User journeys complete.
- [ ] Empty, partial, unsupported and failure states handled.
- [ ] Report export reviewed.
- [ ] Known limitations published.

## Quality
- [ ] Unit, integration and E2E suites pass.
- [ ] Accuracy benchmark completed and reproducible.
- [ ] Performance tests completed on documented hardware.
- [ ] Upgrade, rollback and uninstall tested.
- [ ] Accessibility review completed.

## Security
- [ ] Threat model reviewed.
- [ ] Path/symlink/archive tests pass.
- [ ] Secret redaction verified.
- [ ] Outbound network behavior tested.
- [ ] Dependencies scanned.
- [ ] SBOM generated.
- [ ] Release artifacts signed.
- [ ] No open critical/high security findings without approved mitigation.

## Operations
- [ ] Installation guide.
- [ ] Support contact and response policy.
- [ ] Vulnerability disclosure process.
- [ ] Diagnostics redacted.
- [ ] Backup/deletion process where applicable.
- [ ] Release notes and known issues.

## Commercial
- [ ] Licence and third-party notices correct.
- [ ] Pricing and terms approved.
- [ ] Website claims match tested capabilities.
- [ ] Demo uses authorized data.
- [ ] Customer contract/SOW approved.

## Approval
Engineering: [name/date]  
Security: [name/date]  
Product: [name/date]  
Founder release approval: [name/date]
