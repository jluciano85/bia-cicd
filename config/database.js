const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { fromIni, fromEnv } = require("@aws-sdk/credential-providers");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");

async function isLocalConnection() {
  return (
    process.env.DB_HOST === undefined ||
    process.env.DB_HOST === "database" ||
    process.env.DB_HOST === "127.0.0.1" ||
    process.env.DB_HOST === "localhost"
  );
}

async function getRemoteDialectOptions() {
  return {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };
}

async function getConfig() {
  let dbConfig = {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PWD || "postgres",
    database: process.env.DB_NAME || "bia_prod",  // Adicionei fallback
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 5432,  // Mudei para a porta padrão do PostgreSQL
    dialect: "postgres",
    dialectOptions: await isLocalConnection() ? {} : await getRemoteDialectOptions(),
  };

  if(process.env.DB_SECRET_NAME && process.env.DB_SECRET_NAME.trim() !== '') {
    const secretsManagerClient = await createSecretsManagerClient();
    const secrets = await getSecrets(secretsManagerClient);

    if(secrets) {
      console.log("DEBUG: Secrets recebidos:", secrets);

      // Ajuste para o formato do seu secret
      dbConfig.username = secrets.username;
      dbConfig.password = secrets.password;
      dbConfig.host = secrets.host || process.env.DB_HOST || "bia2.cedew2g0o18b.us-east-1.rds.amazonaws.com";
      dbConfig.port = parseInt(secrets.port || "5432", 10);  // Conversão segura para número
      dbConfig.database = secrets.dbname || secrets.database || "bia_prod";

      await imprimirSecrets(secrets);
    }
  }
  return dbConfig;
}

async function createSecretsManagerClient() {
  let credentials;
  
  if (process.env.IS_LOCAL === "true") {
    credentials = fromEnv();
  }
  
  if (process.env.DB_SECRET_NAME) {
    const client = new SecretsManagerClient({
      region: process.env.DB_REGION || "us-east-1",  // Fallback para sua região
      credentials
    });

    if(process.env.DEBUG_SECRET === "true"){
      const stsClient = new STSClient({
        region: process.env.DB_REGION || "us-east-1",
        credentials
      });

      try {
        const identity = await stsClient.send(new GetCallerIdentityCommand({}));
        console.log('Credenciais carregadas com sucesso:', identity);
      } catch (error) {
        console.error('Erro ao carregar credenciais:', error);
      }
    }
    return client;
  }
  return null;
}

async function imprimirSecrets(secrets) {
  if(process.env.DEBUG_SECRET === "true") {
    console.log("Secrets carregados:", {
      username: secrets.postgres || secrets.username,
      password: "***",  // Não logamos a senha real
      host: secrets.host,
      database: secrets.dbname || secrets.database
    });
  }
}

async function getSecrets(secretsManagerClient) {
  try {
    if (!secretsManagerClient) {
      console.error('Cliente do Secrets Manager não instanciado');
      return null;
    }
    
    const command = new GetSecretValueCommand({ 
      SecretId: process.env.DB_SECRET_NAME 
    });
    const data = await secretsManagerClient.send(command);

    return JSON.parse(data.SecretString || '{}');
  } catch (err) {
    console.error('Erro ao recuperar secrets:', err);
    throw err;
  }
}

module.exports = getConfig;