FROM node:24-bookworm

# Install basic development tools
RUN apt update && apt install -y less man-db sudo

RUN apt install -y \
    xvfb \
    fonts-noto-color-emoji \
    fonts-unifont \
    libfontconfig1 \
    libfreetype6 \
    xfonts-scalable \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-tlwg-loma-otf \
    fonts-freefont-ttf \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxcursor1 \
    libgtk-3-0


# Ensure default `node` user has access to `sudo`
ARG USERNAME=node
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

RUN mkdir -p /home/node/.cache/ms-playwright
RUN mkdir -p /workspaces/atomic-crm/node_modules

RUN chown -R node:node /home/node/.cache /workspaces/atomic-crm

RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/node/.bashrc
RUN echo 'alias g="git"' >> /home/node/.bash_aliases

USER node

WORKDIR /tmp

RUN curl -fsSL https://claude.ai/install.sh -o claude-install.sh && \
    chmod +x claude-install.sh && \
    ./claude-install.sh && \
    rm claude-install.sh

WORKDIR /workspaces/atomic-crm
