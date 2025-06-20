const getConfig = require("./database");

module.exports = async () => {
  const config = await getConfig();
  return config;
};
