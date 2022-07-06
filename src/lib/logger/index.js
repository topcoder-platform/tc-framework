/**
 * This module contains the winston logger configuration.
 */

const _ = require('lodash')
const Joi = require('joi')
const util = require('util')
const getParams = require('get-parameter-names')
const { createLogger, format, transports } = require('winston')
 const { SpanStatusCode } = require('@opentelemetry/api')
 const Tracer = require('./tracer')

 const spanContext = []

/**
 * 
 * @param {Object} config The config object
 * @returns 
 */
module.exports = (config) => {
  const tracer = Tracer(config)

  const logger = createLogger({
    level: config.LOG_LEVEL,
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      })
    ]
  })

  /**
  * Log error details with signature
  * @param err the error
  * @param signature the signature
  */
  logger.logFullError = (err, signature) => {
    if (!err) {
      return
    }
    if (signature) {
      logger.error(`Error happened in ${signature}`)
    }
    logger.error(util.inspect(err))
    if (!err.logged) {
      logger.error(err.stack)
      err.logged = true
    }
  }

  /**
  * Remove invalid properties from the object and hide long arrays
  * @param {Object} obj the object
  * @returns {Object} the new object with removed properties
  * @private
  */
  const _sanitizeObject = (obj) => {
    try {
      return JSON.parse(JSON.stringify(obj, (name, value) => {
        // Array of field names that should not be logged
        // add field if necessary (password, tokens etc)
        const removeFields = ['userToken']
        if (_.includes(removeFields, name)) {
          return '<removed>'
        }
        if (_.isArray(value) && value.length > 30) {
          return `Array(${value.length})`
        }
        return value
      }))
    } catch (e) {
      return obj
    }
  }

  /**
  * Convert array with arguments to object
  * @param {Array} params the name of parameters
  * @param {Array} arr the array with values
  * @private
  */
  const _combineObject = (params, arr) => {
    const ret = {}
    _.each(arr, (arg, i) => {
      ret[params[i]] = arg
    })
    return ret
  }

  /**
  * Decorate all functions of a service and log debug information if DEBUG is enabled
  * @param {Object} service the service
  */
  logger.decorateWithLogging = (service) => {
    if (config.LOG_LEVEL !== 'debug') {
      return
    }
    _.each(service, (method, name) => {
      const params = method.params || getParams(method)
      service[name] = async function () {
        logger.debug(`ENTER ${name}`)
        logger.debug('input arguments')
        const args = Array.prototype.slice.call(arguments)
        logger.debug(util.inspect(_sanitizeObject(_combineObject(params, args))))
        try {
          const result = await method.apply(this, arguments)
          logger.debug(`EXIT ${name}`)
          logger.debug('output arguments')
          if (result !== null && result !== undefined) {
            logger.debug(util.inspect(_sanitizeObject(result)))
          }
          return result
        } catch (e) {
          logger.logFullError(e, name)
          throw e
        }
      }
    })
  }

  /**
  * Decorate all functions of a service and validate input values
  * and replace input arguments with sanitized result form Joi
  * Service method must have a `schema` property with Joi schema
  * @param {Object} service the service
  */
  logger.decorateWithValidators = function (service) {
    _.each(service, (method, name) => {
      if (!method.schema) {
        return
      }
      const params = getParams(method)
      service[name] = async function () {
        const args = Array.prototype.slice.call(arguments)
        const value = _combineObject(params, args)
        const normalized = Joi.attempt(value, method.schema)

        const newArgs = []
        // Joi will normalize values
        // for example string number '1' to 1
        // if schema type is number
        _.each(params, (param) => {
          newArgs.push(normalized[param])
        })
        return method.apply(this, newArgs)
      }
      service[name].params = params
    })
  }



/**
* Decorate all functions of a service and log debug information if DEBUG is enabled
* @param {Object} service the service
*/
logger.decorateWithApm = (service) => {
  _.each(service, (method, name) => {
    if (!method.apm) {
      return
    }
    service[name] = async function () {
      let span
      // check if caller has alredy a span
      if (spanContext.length > 0) {
        const ctx = tracer.setSpan(context.active(), spanContext[spanContext.length - 1]);
        span = tracer.startSpan(name, undefined, ctx);
      } else {
        span = tracer.startSpan(name)
      }
      spanContext.push(span)
      // If we get here and nothing has thrown, the request completed successfully
      try {
        const res = await method.apply(this, arguments)
        span.setStatus({ code: SpanStatusCode.OK })
        return res
      } catch (e) {
        // When we catch an error, we want to show that an error occurred
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: e.message
        })
      } finally {
        // Every span must be ended or it will not be exported
        span.end()
        spanContext.pop()
      }
    }
  })
}

  /**
  * Apply logger and validation decorators
  * @param {Object} service the service to wrap
  */
  logger.buildService = (service) => {
    logger.decorateWithValidators(service)
    logger.decorateWithLogging(service)
    logger.decorateWithApm(service)
  }
  
  return logger
}
