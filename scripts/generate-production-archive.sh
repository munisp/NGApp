#!/bin/bash
# =============================================================================
# Production Archive Generator
# =============================================================================
# Generates a production-ready archive with mandatory integrity checks.
# REFUSES to create an archive if referential integrity check fails.
#
# Usage: bash scripts/generate-production-archive.sh [output_path]
#   output_path   Where to write the archive (default: ~/payment-switch-production-vN.tar.gz)
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
OUTPUT="${1:-/home/ubuntu/payment-switch-production-${TIMESTAMP}.tar.gz}"

cd "$REPO_ROOT"

echo "=============================================="
echo "  Production Archive Generator"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="
echo ""

# -------------------------------------------------------
# STEP 1: Run integrity check (MANDATORY — cannot be skipped)
# -------------------------------------------------------
echo "STEP 1: Running referential integrity check..."
echo ""

if ! bash scripts/archive-integrity-check.sh; then
    echo ""
    echo "ABORTED: Integrity check failed. Fix errors above before generating archive."
    exit 1
fi

echo ""

# -------------------------------------------------------
# STEP 2: Generate file inventory (pre-archive manifest)
# -------------------------------------------------------
echo "STEP 2: Generating pre-archive inventory..."

INVENTORY_FILE="/tmp/archive-inventory-${TIMESTAMP}.txt"
find . -not -path './.git/*' -type f | sort > "$INVENTORY_FILE"
TOTAL_FILES=$(wc -l < "$INVENTORY_FILE")
TOTAL_SIZE=$(du -sh --exclude='.git' . 2>/dev/null | cut -f1)

echo "  Files to archive: ${TOTAL_FILES}"
echo "  Total size: ${TOTAL_SIZE}"
echo ""

# -------------------------------------------------------
# STEP 3: Create archive
# -------------------------------------------------------
echo "STEP 3: Creating archive..."
echo "  Output: ${OUTPUT}"
echo "  Excluding: target/, client/dev-dist/"
echo ""

tar czf "$OUTPUT" \
    --exclude='target' \
    --exclude='client/dev-dist' \
    . 2>&1

ARCHIVE_SIZE=$(du -sh "$OUTPUT" | cut -f1)
ARCHIVE_FILES=$(tar tzf "$OUTPUT" | wc -l)
SHA256=$(sha256sum "$OUTPUT" | cut -d' ' -f1)

echo ""

# -------------------------------------------------------
# STEP 4: Post-archive verification
# -------------------------------------------------------
echo "STEP 4: Post-archive verification..."

# Verify critical directories exist in archive
ARCHIVE_DIRS=$(tar tzf "$OUTPUT" | sed 's|^\./||' | sed 's|/.*|/|' | sort -u)

REQUIRED_TOP_DIRS=(
    "admin-dashboard/"
    "client/"
    "config/"
    "docs/"
    "drizzle/"
    "k8s/"
    "middleware/"
    "mobile/"
    "monitoring/"
    "node_modules/"
    "orchestrator/"
    "payment-core/"
    "payment-switch/"
    "scripts/"
    "server/"
    ".github/"
    ".manus/"
)

POST_ERRORS=0
for dir in "${REQUIRED_TOP_DIRS[@]}"; do
    if echo "$ARCHIVE_DIRS" | grep -q "^${dir}$" 2>/dev/null || tar tzf "$OUTPUT" | grep -q "^\.\/${dir}" 2>/dev/null; then
        echo "  [OK] ${dir}"
    else
        echo "  [MISSING] ${dir} NOT FOUND IN ARCHIVE!"
        POST_ERRORS=$((POST_ERRORS + 1))
    fi
done

echo ""

if [ "$POST_ERRORS" -gt 0 ]; then
    echo "WARNING: ${POST_ERRORS} directories missing from archive!"
    echo "Archive may be incomplete."
fi

# -------------------------------------------------------
# STEP 5: Generate receipt
# -------------------------------------------------------
RECEIPT_FILE="${OUTPUT%.tar.gz}-RECEIPT.md"
cat > "$RECEIPT_FILE" << EOF
# Archive Receipt

| Field | Value |
|-------|-------|
| **Generated** | $(date -u +%Y-%m-%dT%H:%M:%SZ) |
| **Archive** | $(basename "$OUTPUT") |
| **Size** | ${ARCHIVE_SIZE} |
| **Files (in archive)** | ${ARCHIVE_FILES} |
| **Files (on disk)** | ${TOTAL_FILES} |
| **SHA256** | \`${SHA256}\` |
| **Integrity Check** | PASSED |
| **Post-Verification** | ${POST_ERRORS} errors |

## Directory Inventory

| Component | Files | Description |
|-----------|-------|-------------|
EOF

for dir in $(find . -maxdepth 1 -type d ! -name '.' ! -name '.git' | sort); do
    dirname=$(basename "$dir")
    count=$(find "$dir" -type f 2>/dev/null | wc -l)
    size=$(du -sh "$dir" 2>/dev/null | cut -f1)
    echo "| \`${dirname}/\` | ${count} | ${size} |" >> "$RECEIPT_FILE"
done

cat >> "$RECEIPT_FILE" << EOF

## Verification

\`\`\`bash
# Verify checksum
sha256sum $(basename "$OUTPUT")
# Expected: ${SHA256}

# Verify contents
tar tzf $(basename "$OUTPUT") | wc -l
# Expected: ${ARCHIVE_FILES}
\`\`\`
EOF

echo "=============================================="
echo "  Archive Generated Successfully"
echo "=============================================="
echo "  File:     ${OUTPUT}"
echo "  Size:     ${ARCHIVE_SIZE}"
echo "  Files:    ${ARCHIVE_FILES}"
echo "  SHA256:   ${SHA256}"
echo "  Receipt:  ${RECEIPT_FILE}"
echo "=============================================="
