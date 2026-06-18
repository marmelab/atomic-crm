#!/usr/bin/env bash

set -e

su - "$_CONTAINER_USER" <<'EOL'
cd /tmp
curl -fsSL https://claude.ai/install.sh -o claude-install.sh
chmod +x claude-install.sh
./claude-install.sh
rm -f claude-install.sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/node/.bashrc
EOL
