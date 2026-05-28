#!/usr/bin/env python3
"""
Production hardening script for OG-RMM Platform tRPC routers.
1. Migrates publicProcedure → protectedProcedure (except explicitly allowed public endpoints)
2. Ensures TRPCError is imported in all routers
3. Reports what was changed
"""
import re
import os

BASE = '/home/ubuntu/og-rmm-platform'
os.chdir(BASE)

# Procedures that MUST stay public (pre-auth or device-to-server)
KEEP_PUBLIC = {
    'vapidPublicKey',   # push notification subscription (before login)
    'heartbeat',        # device heartbeat (device auth token, not user session)
    'acceptInvite',     # public invite acceptance page
    'verifyInvite',     # public invite token verification
    'me',               # auth.me (returns null when not logged in)
    'logout',           # auth.logout (works when logged in or not)
}

router_files = sorted([
    f for f in os.listdir('server/routers')
    if f.endswith('.ts')
])

total_migrated = 0
total_import_fixes = 0

for fname in router_files:
    path = f'server/routers/{fname}'
    with open(path, 'r') as f:
        original = f.read()
    
    content = original
    migrated = 0
    
    # Find all publicProcedure usages
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        # Check if this line uses publicProcedure.
        if 'publicProcedure.' in line:
            # Extract the procedure name from context (look for "name: publicProcedure")
            # Pattern: "  someName: publicProcedure." or "  someName: publicProcedure\n"
            match = re.search(r'(\w+)\s*:\s*publicProcedure\.', line)
            proc_name = match.group(1) if match else None
            
            if proc_name and proc_name in KEEP_PUBLIC:
                new_lines.append(line)  # Keep as public
            else:
                new_line = line.replace('publicProcedure.', 'protectedProcedure.')
                new_lines.append(new_line)
                if new_line != line:
                    migrated += 1
        else:
            new_lines.append(line)
    
    content = '\n'.join(new_lines)
    
    # Fix imports: if protectedProcedure is now used but not imported, add it
    uses_protected = 'protectedProcedure.' in content
    imports_protected = 'protectedProcedure' in content.split('\n')[0:10].__str__()
    
    # More reliable import check
    import_line_match = re.search(r'import\s*\{([^}]+)\}\s*from\s*["\']\.\./_core/trpc["\']', content)
    if import_line_match and uses_protected:
        imports_str = import_line_match.group(1)
        if 'protectedProcedure' not in imports_str:
            # Add protectedProcedure to imports
            new_imports = imports_str.rstrip() + ', protectedProcedure'
            content = content.replace(import_line_match.group(0),
                f'import {{{new_imports}}} from "../_core/trpc"')
            total_import_fixes += 1
    
    # Ensure TRPCError is imported if not present but used
    if 'TRPCError' not in content and ('throw new TRPCError' in content or migrated > 0):
        # Add TRPCError import at top
        content = 'import { TRPCError } from "@trpc/server";\n' + content
    
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        if migrated > 0:
            print(f'  ✓ {fname}: migrated {migrated} publicProcedure → protectedProcedure')
        else:
            print(f'  ✓ {fname}: import fixes only')
    
    total_migrated += migrated

print(f'\nTotal: {total_migrated} procedures migrated, {total_import_fixes} import fixes')
