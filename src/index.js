const logger = require('./lib/logger')

module.exports = {
  logger,

   // ---------------------------
  // register middlewares
  // ---------------------------
  middleware: {
    jwtAuthenticator: require('./lib/auth/middleware/jwtAuthenticator'),
    logger: require('./lib/auth/middleware/logger'),
    permissions: require('./lib/auth/middleware/permissions')
  },

  Authorizer: require('./lib/auth/authorizer'),
  // ---------------------------
  // util
  // ---------------------------
  util: require('./lib/util'),
  logger: require('./lib/auth/logger'),

  auth: {
    m2m: require('./lib/auth/authorization/m2m'),
    verifier: require('./lib/auth/authorization/verifier')  
  }

}