#!/usr/bin/env python3
"""
Enforces RBAC by upgrading specific procedures to adminProcedure.
Also ensures adminProcedure is imported in each affected router.
"""
import re
import os

BASE = '/home/ubuntu/og-rmm-platform'
os.chdir(BASE)

# Map of file -> list of procedure names to upgrade to adminProcedure
ADMIN_UPGRADES = {
    'server/routers/damageAssessment.ts': ['deleteThreshold'],
    'server/routers/demandResponse.ts': ['deleteProgram'],
    'server/routers/deviceManagement.ts': ['deleteDevice'],
    'server/routers/domain.ts': ['issue', 'deleteScenario'],
    'server/routers/otaManagement.ts': ['createCampaign'],
    'server/routers/productionOptimization.ts': ['deleteCurve'],
    'server/routers/wells.ts': ['deleteAlarmRule', 'deleteWell'],
}

def ensure_admin_import(content: str, path: str) -> str:
    """Add adminProcedure to the trpc import if not already present."""
    import_match = re.search(r'import\s*\{([^}]+)\}\s*from\s*["\']\.\./_core/trpc["\']', content)
    if not import_match:
        return content
    imports_str = import_match.group(1)
    if 'adminProcedure' in imports_str:
        return content
    new_imports = imports_str.rstrip() + ', adminProcedure'
    return content.replace(import_match.group(0),
        f'import {{{new_imports}}} from "../_core/trpc"')

total_upgraded = 0

for path, procedures in ADMIN_UPGRADES.items():
    if not os.path.exists(path):
        print(f'SKIP (not found): {path}')
        continue

    with open(path) as f:
        content = f.read()

    original = content
    upgraded = 0

    for proc_name in procedures:
        # Pattern: "  procName: protectedProcedure"
        old = f'  {proc_name}: protectedProcedure'
        new = f'  {proc_name}: adminProcedure'
        if old in content:
            content = content.replace(old, new)
            upgraded += 1
        else:
            # Try without leading spaces (some routers use different indent)
            old2 = f'{proc_name}: protectedProcedure'
            if old2 in content:
                content = content.replace(old2, f'{proc_name}: adminProcedure', 1)
                upgraded += 1

    if upgraded > 0:
        content = ensure_admin_import(content, path)

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f'  ✓ {os.path.basename(path)}: upgraded {upgraded} procedures to adminProcedure')

    total_upgraded += upgraded

print(f'\nTotal procedures upgraded to adminProcedure: {total_upgraded}')
