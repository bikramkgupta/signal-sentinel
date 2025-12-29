#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "DevContainer Post-Create Setup"
echo "=========================================="


# Fix ownership of credential directories
echo "Setting up credential directories..."
if [ -d "/home/vscode/.config" ]; then
    sudo chown -R vscode:vscode /home/vscode/.config
    sudo chmod -R 755 /home/vscode/.config
fi

if [ -d "/home/vscode/.claude" ]; then
    sudo chown -R vscode:vscode /home/vscode/.claude
    sudo chmod -R 700 /home/vscode/.claude
fi

# ==========================================
# Claude Code Settings Setup
# ==========================================
echo "Setting up Claude Code configuration..."

# Create hooks directory
mkdir -p /home/vscode/.claude/hooks

# Create log-session-start.sh hook
cat > /home/vscode/.claude/hooks/log-session-start.sh << 'HOOK_SESSION'
#!/bin/bash
# Creates session log file in project's .claude-logs directory

# Read hook input (contains session_id, workspace info, etc.)
input=$(cat)

# Create logs directory in current project
mkdir -p .claude-logs

# Generate timestamp-based filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Store current session identifier for other hooks to reference
echo "$TIMESTAMP" > .claude-logs/.current_session

# Create log file with header
LOG_FILE=".claude-logs/${TIMESTAMP}.log"
{
  echo "=============================================="
  echo "Session: $TIMESTAMP"
  echo "Started: $(date)"
  echo "Directory: $(pwd)"
  echo "=============================================="
  echo ""
} > "$LOG_FILE"

# Reminder for manual config
echo "⚠️  Remember: /config → disable autocompact"
HOOK_SESSION

# Create log-tool-use.sh hook
cat > /home/vscode/.claude/hooks/log-tool-use.sh << 'HOOK_TOOL'
#!/bin/bash
# Logs tool calls to session log (simple version)

# Read hook input from stdin
input=$(cat)

# Get current session timestamp
SESSION_TS=$(cat .claude-logs/.current_session 2>/dev/null)
if [ -z "$SESSION_TS" ]; then
  exit 0  # No active session log, skip
fi

LOG_FILE=".claude-logs/${SESSION_TS}.log"

# Extract tool info
TOOL_NAME=$(echo "$input" | jq -r '.tool_name // "unknown"')
TOOL_INPUT=$(echo "$input" | jq -r '.tool_input // {}')

# Format the log entry based on tool type
TIME=$(date +%H:%M:%S)

case "$TOOL_NAME" in
  "Write"|"Edit"|"Read"|"Glob")
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // "unknown"')
    if [[ "$FILE_PATH" == *"/plans/"* ]]; then
      echo "[$TIME] PLAN: $TOOL_NAME -> $FILE_PATH" >> "$LOG_FILE"
    else
      echo "[$TIME] $TOOL_NAME: $FILE_PATH" >> "$LOG_FILE"
    fi
    ;;

  "Bash")
    COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // "unknown"' | head -c 100)
    echo "[$TIME] Bash: $COMMAND" >> "$LOG_FILE"
    ;;

  "Grep")
    PATTERN=$(echo "$TOOL_INPUT" | jq -r '.pattern // "unknown"')
    echo "[$TIME] Grep: \"$PATTERN\"" >> "$LOG_FILE"
    ;;

  "Task")
    DESC=$(echo "$TOOL_INPUT" | jq -r '.description // "unknown"')
    echo "[$TIME] Task: $DESC" >> "$LOG_FILE"
    ;;

  "WebFetch"|"WebSearch")
    URL=$(echo "$TOOL_INPUT" | jq -r '.url // .query // "unknown"')
    echo "[$TIME] $TOOL_NAME: $URL" >> "$LOG_FILE"
    ;;

  *)
    echo "[$TIME] $TOOL_NAME" >> "$LOG_FILE"
    ;;
esac
HOOK_TOOL

# Create statusline.sh
cat > /home/vscode/.claude/statusline.sh << 'STATUSLINE'
#!/bin/bash
input=$(cat)

# Extract data
MODEL=$(echo "$input" | jq -r '.model.display_name')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size')
USAGE=$(echo "$input" | jq '.context_window.current_usage')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir')

if [ "$USAGE" != "null" ]; then
    # Get individual token counts
    INPUT_TOKENS=$(echo "$USAGE" | jq -r '.input_tokens')
    OUTPUT_TOKENS=$(echo "$USAGE" | jq -r '.output_tokens')
    CACHE_CREATE=$(echo "$USAGE" | jq -r '.cache_creation_input_tokens')
    CACHE_READ=$(echo "$USAGE" | jq -r '.cache_read_input_tokens')

    # Total current context
    CURRENT_TOKENS=$(echo "$USAGE" | jq '.input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens')
    PERCENT_USED=$((CURRENT_TOKENS * 100 / CONTEXT_SIZE))

    # Format in K for readability
    CURRENT_K=$((CURRENT_TOKENS / 1000))
    CONTEXT_K=$((CONTEXT_SIZE / 1000))
    OUTPUT_K=$((OUTPUT_TOKENS / 1000))
    CACHE_READ_K=$((CACHE_READ / 1000))

    # Truncate directory path
    DIR=$(basename "$CURRENT_DIR")

    # Build statusline with useful info
    echo "[$MODEL] 📊 ${CURRENT_K}K/${CONTEXT_K}K (${PERCENT_USED}%) | 💾 ${CACHE_READ_K}K cached | 📤 ${OUTPUT_K}K out | 💰 \${COST}"
else
    DIR=$(basename "$CURRENT_DIR")
    echo "[$MODEL] Context: 0% | 📁 $DIR"
fi
STATUSLINE

# Create settings.json
cat > /home/vscode/.claude/settings.json << 'SETTINGS'
{
  "permissions": {
    "defaultMode": "default",
    "deny": [
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(~/.do-*)",
      "Bash(rm -rf /)",
      "Bash(rm -rf ~)"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "for f in /workspaces/app/.devcontainer/.env .env; do if [ -f \"$f\" ]; then set -a; source \"$f\"; set +a; fi; done; env >> \"$CLAUDE_ENV_FILE\""
          },
          {
            "type": "command",
            "command": "~/.claude/hooks/log-session-start.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/log-tool-use.sh"
          }
        ]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 0
  },
  "alwaysThinkingEnabled": true
}
SETTINGS

# Make scripts executable
chmod +x /home/vscode/.claude/hooks/log-session-start.sh
chmod +x /home/vscode/.claude/hooks/log-tool-use.sh
chmod +x /home/vscode/.claude/statusline.sh

# Fix ownership
sudo chown -R vscode:vscode /home/vscode/.claude

echo "Claude Code configuration complete!"

if [ -d "/home/vscode/.codex" ]; then
    sudo chown -R vscode:vscode /home/vscode/.codex
    sudo chmod -R 700 /home/vscode/.codex
fi

# Add an alias for codex for:
# codex --ask-for-approval never --sandbox danger-full-access
echo "alias codex2='codex --ask-for-approval never --sandbox danger-full-access'" >> ~/.bashrc
source ~/.bashrc

# Add an alies for claude for:
# claude --dangerously-skip-permissions
echo "alias claude2='claude --dangerously-skip-permissions'" >> ~/.bashrc
source ~/.bashrc

echo "=========================================="
echo "DevContainer Ready!"
echo "=========================================="