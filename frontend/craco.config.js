const path = require("path");
require("dotenv").config();

const webpackConfig = {
  eslint: {
    enable: false,
  },
  typescript: {
    enableTypeChecking: false,
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    configure: (cfg) => {
      cfg.watchOptions = {
        ...cfg.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/build/**",
          "**/dist/**",
          "**/coverage/**",
          "**/public/**",
        ],
      };
      return cfg;
    },
  },
};

module.exports = webpackConfig;
