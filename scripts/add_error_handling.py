#!/usr/bin/env python3
"""
Adds try/catch to async tRPC handler bodies using a token-based brace counter.
Strategy: For each .mutation(async or .query(async handler, wrap the ENTIRE
handler body in a single try { ... } catch (err) { throw TRPCError } block.

Safe approach: only wraps handlers that have NO try { already inside them.
"""
import re
import os

BASE = '/home/ubuntu/og-rmm-platform'
os.chdir(BASE)

ROUTERS_NEEDING_TRY = [
    'server/routers/cache.ts',
    'server/routers/deviceManagement.ts',
    'server/routers/influxBenchmark.ts',
    'server/routers/ledger.ts',
    'server/routers/otaManagement.ts',
    'server/routers/silCertification.ts',
    'server/routers/streaming.ts',
    'server/routers/userOnboarding.ts',
    'server/routers/wells.ts',
]

def get_indent(line: str) -> str:
    return line[:len(line) - len(line.lstrip())]

def wrap_handlers(content: str, filename: str) -> tuple[str, int]:
    """Wrap async handler bodies in try/catch. Returns (new_content, count_wrapped)."""
    lines = content.split('\n')
    result = []
    i = 0
    wrapped = 0

    while i < len(lines):
        line = lines[i]

        # Detect start of an async handler: .mutation(async or .query(async
        if re.search(r'\.(mutation|query)\s*\(\s*async\s*\(', line):
            result.append(line)
            i += 1

            # Find the arrow => { that opens the handler body
            arrow_found = False
            while i < len(lines):
                l = lines[i]
                result.append(l)
                i += 1
                # The handler body opens when we see => { on a line
                if '=>' in l and '{' in l:
                    arrow_found = True
                    break
                # If we hit => without { it's a single-expression handler, skip
                if '=>' in l and '{' not in l:
                    break

            if not arrow_found:
                continue

            # Peek ahead: if next non-empty line is already 'try {', skip
            peek = i
            while peek < len(lines) and lines[peek].strip() == '':
                peek += 1

            if peek < len(lines) and lines[peek].strip().startswith('try {'):
                continue  # Already has try/catch

            # Determine body indentation from the first non-empty body line
            body_indent = '      '
            if peek < len(lines) and lines[peek].strip():
                body_indent = get_indent(lines[peek])

            # Collect body lines until brace_count reaches 0
            # brace_count starts at 1 (the { from => {)
            brace_count = 1
            body_lines = []

            while i < len(lines) and brace_count > 0:
                l = lines[i]
                # Count braces, but skip template literal ${...} patterns
                # Simple approach: count { and } but subtract template ${
                opens = l.count('{') - l.count('${') - l.count('`{')
                closes = l.count('}')
                brace_count += opens - closes

                if brace_count <= 0:
                    # This is the closing }) line — emit try/catch wrapper
                    result.append(f'{body_indent}try {{')
                    for bl in body_lines:
                        result.append('  ' + bl)
                    result.append(f'{body_indent}}} catch (err: unknown) {{')
                    result.append(f'{body_indent}  if (err instanceof TRPCError) throw err;')
                    result.append(f'{body_indent}  const msg = err instanceof Error ? err.message : String(err);')
                    result.append(f'{body_indent}  throw new TRPCError({{ code: "INTERNAL_SERVER_ERROR", message: msg }});')
                    result.append(f'{body_indent}}}')
                    result.append(l)  # closing }),
                    wrapped += 1
                else:
                    body_lines.append(l)
                i += 1
        else:
            result.append(line)
            i += 1

    return '\n'.join(result), wrapped


def ensure_trpcerror_import(content: str) -> str:
    """Add TRPCError import if not present."""
    if 'TRPCError' in content:
        return content
    # Add after first import line
    lines = content.split('\n')
    for idx, line in enumerate(lines):
        if line.startswith('import '):
            lines.insert(idx, 'import { TRPCError } from "@trpc/server";')
            break
    return '\n'.join(lines)


total_wrapped = 0

for path in ROUTERS_NEEDING_TRY:
    if not os.path.exists(path):
        print(f'SKIP (not found): {path}')
        continue

    with open(path) as f:
        original = f.read()

    content, n = wrap_handlers(original, path)
    content = ensure_trpcerror_import(content)

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f'  ✓ {os.path.basename(path)}: wrapped {n} handlers')
    else:
        print(f'  - {os.path.basename(path)}: no changes')

    total_wrapped += n

print(f'\nTotal handlers wrapped: {total_wrapped}')
