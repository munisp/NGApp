# EscrowProtect Platform Makefile
# Production Readiness Baseline (PRB) v1

.PHONY: verify help

# Default target
help:
	@echo "EscrowProtect Platform"
	@echo "======================"
	@echo ""
	@echo "Available targets:"
	@echo "  make verify  - Run PRB v1 verification (pass/fail)"
	@echo "  make help    - Show this help message"
	@echo ""
	@echo "PRB v1 Documentation: PRB_V1.md"

# PRB v1 Verification
verify:
	@chmod +x scripts/verify_prb_v1.sh
	@./scripts/verify_prb_v1.sh
