#!/usr/bin/env python3
"""Fix db variable scope issues in wells.ts where db is declared inside try but used outside."""
import re

path = 'server/routers/wells.ts'
with open(path) as f:
    content = f.read()

# Pattern: try { const db = ...; if (!db) throw ...; } catch { ... } \n  CODE_USING_DB
# We need to move CODE_USING_DB inside the try block

# Use a state machine approach to find and fix these patterns
lines = content.split('\n')
result = []
i = 0
fixes = 0

while i < len(lines):
    line = lines[i]
    
    # Detect: try { const db = await getDb(); if (!db) throw ... }
    # followed by catch block, then code using db
    if line.strip() == 'try {' and i + 1 < len(lines):
        next_line = lines[i+1].strip() if i+1 < len(lines) else ''
        if 'const db = await getDb()' in next_line:
            # Collect the try block
            try_lines = [line]  # 'try {'
            j = i + 1
            brace_count = 1
            try_body = []
            
            while j < len(lines) and brace_count > 0:
                l = lines[j]
                opens = l.count('{') - l.count('${')
                closes = l.count('}')
                brace_count += opens - closes
                if brace_count > 0:
                    try_body.append(l)
                j += 1
            
            # j now points to line after closing }
            # Check if try body ends with just db init (no actual work)
            non_empty_body = [l.strip() for l in try_body if l.strip()]
            is_db_only_try = (
                len(non_empty_body) <= 2 and
                all('getDb' in l or 'throw' in l or 'if' in l for l in non_empty_body)
            )
            
            if is_db_only_try:
                # Look for catch block
                catch_start = j
                if j < len(lines) and lines[j].strip().startswith('} catch'):
                    catch_lines = [lines[j]]  # '} catch ...'
                    k = j + 1
                    brace_count2 = 1
                    catch_body = []
                    while k < len(lines) and brace_count2 > 0:
                        l = lines[k]
                        opens = l.count('{') - l.count('${')
                        closes = l.count('}')
                        brace_count2 += opens - closes
                        if brace_count2 > 0:
                            catch_body.append(l)
                        k += 1
                    # k now points to line after catch closing }
                    
                    # Collect remaining code until handler closing }),
                    remaining = []
                    m = k
                    while m < len(lines):
                        l = lines[m]
                        remaining.append(l)
                        m += 1
                        # Stop at handler close
                        if l.strip() in ('    }),', '    }),', '  }),'):
                            break
                    
                    if remaining:
                        # Get indent from try body
                        indent = '        '  # 8 spaces default
                        if try_body:
                            first_body = try_body[0]
                            indent = first_body[:len(first_body) - len(first_body.lstrip())]
                        
                        # Reconstruct: try { db_init; remaining_code } catch { ... }
                        new_try = ['      try {']
                        for bl in try_body:
                            new_try.append(bl)
                        # Add remaining code (except the closing }),) inside try
                        handler_close = remaining[-1]
                        inner_code = remaining[:-1]
                        for rl in inner_code:
                            # Re-indent if needed
                            new_try.append(rl)
                        new_try.append('      } catch (err: unknown) {')
                        for cl in catch_body:
                            new_try.append(cl)
                        new_try.append('      }')
                        new_try.append(handler_close)
                        
                        result.extend(new_try)
                        i = m  # Skip all processed lines
                        fixes += 1
                        continue
    
    result.append(line)
    i += 1

if fixes > 0:
    with open(path, 'w') as f:
        f.write('\n'.join(result))
    print(f'Fixed {fixes} db scope issues in {path}')
else:
    print('No db scope patterns found via state machine - trying direct line fixes')
    # Direct approach: find lines where db is used after catch block
    # Just find the specific lines with errors (315, 486, 580) and fix them manually
    print('Please check lines 315, 486, 580 manually')
