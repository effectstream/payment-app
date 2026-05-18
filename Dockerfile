FROM oven/bun:1

RUN apt-get update && apt-get install -y \
    curl \
    lsof \
    iproute2 \
    unzip \
    procps \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Node.js (required for some Hardhat postinstall scripts and Vite plugins)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Foundry (arch-aware)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then FOUNDRY_ARCH="arm64"; else FOUNDRY_ARCH="amd64"; fi && \
    curl -L "https://github.com/foundry-rs/foundry/releases/download/v1.3.0-rc1/foundry_v1.3.0-rc1_alpine_${FOUNDRY_ARCH}.tar.gz" -o foundry.tar.gz \
    && tar -xzf foundry.tar.gz \
    && mv anvil cast chisel forge /usr/local/bin/ \
    && rm -rf foundry.tar.gz

# Pre-download solc 0.8.30 (Bun's broken webstreams polyfill prevents runtime download)
RUN mkdir -p /root/.cache/hardhat-nodejs/compilers-v3/wasm && \
    curl -fsSL "https://binaries.soliditylang.org/wasm/list.json" \
      -o /root/.cache/hardhat-nodejs/compilers-v3/wasm/list.json && \
    curl -fsSL "https://binaries.soliditylang.org/wasm/soljson-v0.8.30+commit.73712a01.js" \
      -o /root/.cache/hardhat-nodejs/compilers-v3/wasm/soljson-v0.8.30+commit.73712a01.js && \
    if [ "$(uname -m)" != "aarch64" ]; then \
      mkdir -p /root/.cache/hardhat-nodejs/compilers-v3/linux-amd64 && \
      curl -fsSL "https://binaries.soliditylang.org/linux-amd64/list.json" \
        -o /root/.cache/hardhat-nodejs/compilers-v3/linux-amd64/list.json && \
      curl -fsSL "https://binaries.soliditylang.org/linux-amd64/solc-linux-amd64-v0.8.30+commit.73712a01" \
        -o /root/.cache/hardhat-nodejs/compilers-v3/linux-amd64/solc-linux-amd64-v0.8.30+commit.73712a01 && \
      chmod +x /root/.cache/hardhat-nodejs/compilers-v3/linux-amd64/solc-linux-amd64-v0.8.30+commit.73712a01; \
    fi

WORKDIR /app

COPY package.json bun.lockb* ./
COPY packages packages
COPY start.dev.ts start.mainnet.ts tsconfig.json ./

RUN bun install

# Bun on Linux does NOT create workspace symlinks in node_modules — create them manually.
RUN bun -e " \
  const fs = require('fs'); const path = require('path'); \
  const pkg = JSON.parse(fs.readFileSync('package.json','utf8')); \
  for (const pattern of pkg.workspaces || []) { \
    const glob = new Bun.Glob(pattern); \
    for (const dir of glob.scanSync({onlyFiles:false})) { \
      const p = path.join(dir,'package.json'); \
      if (!fs.existsSync(p)) continue; \
      const wp = JSON.parse(fs.readFileSync(p,'utf8')); \
      if (!wp.name) continue; \
      const [scope,name] = wp.name.startsWith('@') ? wp.name.split('/') : [null, wp.name]; \
      const target = path.resolve(dir); \
      const linkDir = scope ? path.join('node_modules', scope) : 'node_modules'; \
      fs.mkdirSync(linkDir, {recursive:true}); \
      const link = path.join(linkDir, name); \
      if (!fs.existsSync(link)) { fs.symlinkSync(target, link); console.log(link + ' -> ' + target); } \
    } \
  }"

# Compile contracts so generated artifacts (mod.ts, ABI bindings) are present.
RUN bun run build:evm

ENV NODE_ENV=development
EXPOSE 4747 9999 10599 3334 8545 5432

CMD ["bunx", "orchestrator", "start", "--config", "start.dev.ts"]
