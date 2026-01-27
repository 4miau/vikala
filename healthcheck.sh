#!/bin/sh
# Health check script for Vikala Docker container

# Check if the bot process is running
if ! pgrep -f "bun" > /dev/null; then
    echo "Bot process not running"
    exit 1
fi

# Check if MongoDB connection is working (if needed)
# This would require additional logic to verify database connectivity

echo "Health check passed"
exit 0
