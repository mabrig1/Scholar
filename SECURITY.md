# Security Policy

Mabrig Researcher Pro handles research files, contact details, order records and payment references. Security reports are welcome and should be handled privately.

## Reporting a vulnerability

Please email **mabrig@mabrigkorie.org** with:

- the affected route or component;
- a concise description of the issue;
- reproducible steps that do not access another user's data;
- the potential impact; and
- any suggested remediation.

Do **not** publish exploitable details, credentials, personal data, private manuscripts or proof-of-concept data from real users in a public GitHub issue.

## Safe research expectations

Please do not:

- access, download, alter or delete another person's records or files;
- perform denial-of-service or high-volume automated testing;
- send malware or destructive payloads;
- attempt social engineering or credential theft;
- test third-party providers outside the Scholar application without their authorization.

Use test data and the minimum activity needed to demonstrate a vulnerability.

## Response

Reports will be triaged based on reproducibility, severity, affected data and exploitability. Acknowledgement, remediation timing and disclosure coordination depend on the issue and available evidence.

## Security controls

Scholar uses repository security scanning, protected administrative routes, request and upload limits, server-side validation, payment-webhook signature verification and research-integrity safeguards. These controls reduce risk but do not constitute a guarantee that the service is vulnerability-free.

Never commit production credentials, API keys, payment secrets or private research data to this repository.
