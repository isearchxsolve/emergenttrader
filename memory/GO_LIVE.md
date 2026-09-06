# Go-Live Operations Runbook

## Preflight

- Confirm backend readiness: `GET /api/health/ready` returns `ok=true`.
- Verify risk policy from `GET /api/risk/status`.
- Confirm `TRADING_PAUSED=false` intentionally.
- Verify webhook endpoint in settings for incident notifications.
- Confirm at least one admin identity exists in `ADMIN_EMAILS`.
- If `ACTION_SIGNING_SECRET` is set, verify signed control requests end-to-end.

## Launch Checklist

- Start with one controlled user account.
- Restrict to a small coin universe (`ALLOWED_COIN_IDS`).
- Set low risk bounds:
  - `MAX_TRADE_USD`
  - `MAX_DAILY_LOSS_USD`
  - `MAX_OPEN_POSITIONS`
- Enable only one active bot strategy initially.

## Emergency Procedures

### Immediate Halt

- Call `POST /api/risk/pause-all` with reason.
- Confirm via `GET /api/risk/status` that `trading_paused=true`.
- Capture audit record for halt in `order_audit`.

### Investigate

- Review bot `last_action`, `status`, `last_error`.
- Review recent trades and order audit events.
- Validate external provider health and quote freshness.

### Recovery

- Fix root cause.
- Test in paper mode.
- Resume via `POST /api/risk/resume-all`.

## Reconciliation

- Compare internal trades/positions with expected balances.
- Check for duplicate submissions (idempotency).
- Verify no negative paper balances.
- Review latest report from `GET /api/ops/reconciliation/latest`.
- Trigger an immediate report with `POST /api/ops/reconciliation/run` when needed.

## Post-Incident

- Document impact window, affected symbols, and remediation.
- Tune risk thresholds if needed.
- Add regression tests for the observed failure mode.
