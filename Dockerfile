FROM public.ecr.aws/docker/library/node:22-slim

# Instalações básicas
RUN apt-get update && \
    apt-get install -y curl python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Instalação global (incluindo o Sequelize CLI)
RUN npm install -g npm@11 sequelize-cli --loglevel=error

WORKDIR /usr/src/app

# Instalação das dependências
COPY package*.json ./
RUN npm install --loglevel=error --include=dev

# Copia o restante do projeto
COPY . .

# Build do client (mantendo sua configuração original)
RUN NODE_OPTIONS=--openssl-legacy-provider \
    REACT_APP_API_URL=http://34.239.240.133 \
    SKIP_PREFLIGHT_CHECK=true \
    npm run build --prefix client && \
    mv client/build build && \
    rm -rf client/* && \
    mv build client/

# Configuração para o Sequelize/RDS
ENV NODE_ENV=production
ENV DB_HOST=bia2.cedew2g0o18b.us-east-1.rds.amazonaws.com
ENV DB_PORT=5432

EXPOSE 8080

CMD ["npm", "start"]