#!/bin/bash
# Archive Manifest Generator
# Generates a manifest of all files that MUST be included in production archives.
# Run this after any session that adds new files, and commit the manifest to git.
# Before generating an archive, compare against this manifest to catch missing files.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST_FILE="${REPO_ROOT}/ARCHIVE_MANIFEST.txt"
MANIFEST_SUMMARY="${REPO_ROOT}/ARCHIVE_MANIFEST_SUMMARY.md"

echo "Generating archive manifest from: ${REPO_ROOT}"

# Generate full file listing (excluding .git, target, dev-dist, node_modules internals)
cd "$REPO_ROOT"

echo "# Archive Manifest - Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MANIFEST_FILE"
echo "# This file lists every directory that MUST be present in production archives." >> "$MANIFEST_FILE"
echo "# Compare with: diff <(tar tzf archive.tar.gz | sed 's|/[^/]*$|/|' | sort -u) <(grep -v '^#' ARCHIVE_MANIFEST.txt | sort -u)" >> "$MANIFEST_FILE"
echo "" >> "$MANIFEST_FILE"

# List all top-level directories and key subdirectories
find . -maxdepth 1 -type d ! -name '.' ! -name '.git' | sort | while read -r dir; do
    file_count=$(find "$dir" -type f 2>/dev/null | wc -l)
    dir_size=$(du -sh "$dir" 2>/dev/null | cut -f1)
    echo "${dir}/ # ${file_count} files, ${dir_size}" >> "$MANIFEST_FILE"
done

# Also list critical individual files at root
find . -maxdepth 1 -type f ! -name '*.tar.gz' | sort | while read -r f; do
    echo "$f" >> "$MANIFEST_FILE"
done

# Generate summary with counts per component
cat > "$MANIFEST_SUMMARY" << 'HEADER'
# Archive Manifest Summary

This file tracks all components that MUST be present in every production archive.
**Generated automatically — commit this file after adding new components.**

## How to Verify an Archive

```bash
# 1. Generate expected manifest
bash scripts/generate-archive-manifest.sh

# 2. List archive contents
tar tzf archive.tar.gz | sed 's|^\./||' | sed 's|/.*|/|' | sort -u > /tmp/archive-dirs.txt

# 3. Compare
diff <(grep -v '^#' ARCHIVE_MANIFEST.txt | grep '/$' | sed 's| #.*||; s|^\./||' | sort -u) /tmp/archive-dirs.txt
```

## Required Components

HEADER

echo "| Component | Files | Size | Critical? |" >> "$MANIFEST_SUMMARY"
echo "|-----------|-------|------|-----------|" >> "$MANIFEST_SUMMARY"

# Generate table rows
find . -maxdepth 1 -type d ! -name '.' ! -name '.git' | sort | while read -r dir; do
    dirname=$(basename "$dir")
    file_count=$(find "$dir" -type f 2>/dev/null | wc -l)
    dir_size=$(du -sh "$dir" 2>/dev/null | cut -f1)
    
    # Mark critical components
    critical="Yes"
    case "$dirname" in
        node_modules|target|dist|client/dev-dist) critical="No (rebuildable)" ;;
    esac
    
    echo "| \`${dirname}/\` | ${file_count} | ${dir_size} | ${critical} |" >> "$MANIFEST_SUMMARY"
done

echo "" >> "$MANIFEST_SUMMARY"
echo "## Root Files" >> "$MANIFEST_SUMMARY"
echo "" >> "$MANIFEST_SUMMARY"
find . -maxdepth 1 -type f ! -name '*.tar.gz' | sort | while read -r f; do
    fname=$(basename "$f")
    fsize=$(du -sh "$f" 2>/dev/null | cut -f1)
    echo "- \`${fname}\` (${fsize})" >> "$MANIFEST_SUMMARY"
done

echo "" >> "$MANIFEST_SUMMARY"
TOTAL_FILES=$(find . -not -path './.git/*' -type f | wc -l)
TOTAL_SIZE=$(du -sh --exclude='.git' . 2>/dev/null | cut -f1)
echo "**Total: ${TOTAL_FILES} files, ${TOTAL_SIZE}**" >> "$MANIFEST_SUMMARY"

echo ""
echo "Manifest written to: ${MANIFEST_FILE}"
echo "Summary written to:  ${MANIFEST_SUMMARY}"
echo "Total files tracked: ${TOTAL_FILES}"
