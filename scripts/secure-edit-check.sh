#!/bin/sh
# securitymaxxing write-time check (PostToolUse on Write|Edit).
#
# Reads the hook's JSON payload on stdin. If the code just written contains a pattern that is
# commonly the start of a vulnerability, it hands Claude a short, specific reminder of the safe
# pattern. It never blocks and never changes the file. It is silent for everything else.
#
# POSIX sh + grep + sed only (no jq, no node), so it runs wherever Claude Code's hooks do.
# Disable with SECURITYMAXXING_HOOKS=off.

[ "${SECURITYMAXXING_HOOKS:-on}" = "off" ] && exit 0

payload=$(cat)

# Only the file path and the newly written text matter.
path=$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

case "$path" in
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.py|*.rb|*.go|*.java|*.kt|*.php|*.cs|*.rs|*.ex|*.exs|*.vue|*.svelte|*.html|*.jinja|*.j2|*.erb) ;;
  *) exit 0 ;;
esac
case "$path" in
  */test/*|*/tests/*|*/__tests__/*|*/spec/*|*.test.*|*.spec.*|*_test.go|*/fixtures/*|*/node_modules/*|*/vendor/*) exit 0 ;;
esac

has() { printf '%s' "$payload" | grep -Eq "$1"; }
notes=""
add() { notes="$notes- $1\n"; }

# A route that reads a resource ID from the request: the ownership check is the bug that ships.
if has 'req\.params\.[A-Za-z_]*[Ii]d|request\.(path_params|match_info)|/\{[a-z_]*id\}|/:[a-zA-Z_]*[Ii]d\b|@PathVariable|\[FromRoute\]|params\[:[a-z_]*id\]' \
   && ! has '[Oo]wner|owner_id|ownerId|user_id|userId|tenant|current_user|currentUser|req\.user|request\.user|session\.user'; then
  add "This handler takes a resource ID from the request. Confirm on the server that the record belongs to the current user/tenant — scope the query by owner (WHERE id = ? AND owner_id = ?) and return 404 when it doesn't."
fi
# SQL assembled from strings.
if has '(SELECT|INSERT|UPDATE|DELETE)[^;]{0,200}(\$\{|" *\+|\x27 *\+|%s\x27|\{[a-z_]+\})' || has 'f\\?"(SELECT|INSERT|UPDATE|DELETE)'; then
  add "SQL appears to be built by string interpolation. Pass values as bound parameters; if an identifier (column, sort order) must vary, map it through an allowlist."
fi
# Shell execution with a composed command string.
if has 'shell=True|os\.system\(|child_process\.exec\(|execSync\(|\bexec\(`|Runtime\.getRuntime\(\)\.exec\(|shell_exec\(|`[^`]*\$\{'; then
  add "A shell command is being run. Use the argument-array form (execFile / subprocess.run([...]) without shell=True) so user input can never become shell syntax."
fi
# Opting out of HTML escaping.
if has 'innerHTML[[:space:]]*=|dangerouslySetInnerHTML|v-html|\|[[:space:]]*safe\b|Markup\(|html_safe|\{@html|bypassSecurityTrust'; then
  add "This opts out of HTML escaping. Only pass content your code authored, or sanitize it (DOMPurify / nh3) first — user-controlled text here is stored XSS."
fi
# Token handling that skips verification.
if has 'verify_signature\\?"?[[:space:]]*:[[:space:]]*False|verify[[:space:]]*=[[:space:]]*False|jwt\.decode\(|algorithms[[:space:]]*=[[:space:]]*None|ignoreExpiration[[:space:]]*:[[:space:]]*true'; then
  add "Token decoding detected. Use the verifying call (jwt.verify / jwt.decode with key and a fixed algorithms list), require exp, and never trust an unverified decode for an access decision."
fi
# Server-side fetch of a URL that may come from the request.
if has '(fetch|axios\.(get|post)|requests\.(get|post)|http\.Get|urlopen)\((req\.|request\.|params|body|url[,)]|target)'; then
  add "This makes a server-side request to a URL that may come from the user (SSRF). Allowlist destinations, or resolve once and reject private, loopback, link-local and metadata addresses before connecting."
fi
# Errors that let the request through.
if has 'catch[^}]{0,80}(next\(\)|return true|allow)|except[^:]{0,60}:\\n?[[:space:]]*(pass|return True)'; then
  add "An error path may fail open. In auth, permission, signature, and rate-limit checks, an exception or timeout must deny, not continue."
fi
# Something that looks like a live credential.
if has 'sk_live_[0-9A-Za-z]{10,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|xox[baprs]-[0-9A-Za-z-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'; then
  add "This looks like a real credential in source. Load it from the environment or a secrets manager instead — and if it was ever committed or shared, rotate it; deleting it doesn't un-leak it."
fi

[ -z "$notes" ] && exit 0

msg="securitymaxxing write-time check for ${path##*/}:\n${notes}Apply these now if they fit, or briefly say why they don't (e.g. the ID is checked by middleware). Patterns: the secure-coding skill."
# Escape for JSON: backslashes and double quotes (our text has none, the path might).
msg=$(printf '%s' "$msg" | sed 's/\\\([^n]\)/\\\\\1/g; s/"/\\"/g')
printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$msg"
exit 0
