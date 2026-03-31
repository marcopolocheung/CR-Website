const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  basePath: isProd ? '/CR-Website' : '',
  assetPrefix: isProd ? '/CR-Website/' : '',
  output: 'export', 
};