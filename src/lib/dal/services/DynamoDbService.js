const errors = require('../utils/errors')
const _ = require('lodash')
const dynamoose = require('dynamoose')
const config = require('config')
const Schema = dynamoose.Schema

// Get the logger instance with the configured parameters
const logger = require('../../../../index').logger(config)

/**
 * This module exports a function to use for creating the DynamoDbService with the given configuration.
 * The configuration of the service should have the following format
 * {
   "dynamooseDefaults":{
      "create":false,
      "update":false,
      "waitForActive":false
   },
   "entities":{
      "tableName1":{
         // entity definition object 2
      },
      "tableName2":{
         // entity definition object 2
      }
    }
  }
 * @param {Object} databaseServiceConfig The configuration object to use for initializing the DynampDB Service
 * @returns The initialized DynamoDB service
 */
module.exports = (databaseServiceConfig) => {
  // The dynamoDB service instance
  const dynamoDbService = {}

  // The models object to be managed by the DynamoDB service
  const models = {}

  // Update the dynamoose AWS global configuration
  // construct the aws global configuration
  // See the supported configuration at https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
  // const awsConfig = {
  //  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  //  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  //  region: process.env.AWS_REGION
    // maxRetries: 10
  //}
   const awsConfig = config.AMAZON.IS_LOCAL_DB ? {
     accessKeyId: config.AMAZON.AWS_ACCESS_KEY_ID,
     secretAccessKey: config.AMAZON.AWS_SECRET_ACCESS_KEY,
     region: config.AMAZON.AWS_REGION
   } : {
     region: config.AMAZON.AWS_REGION
   }

  dynamoose.AWS.config.update(awsConfig)

  if (databaseServiceConfig.isLocalDB) {
    dynamoose.local(databaseServiceConfig.localDatabaseURL)
  }

  dynamoose.setDefaults(databaseServiceConfig.dynamooseDefaults)

  _.forEach(_.keys(databaseServiceConfig.entities), async (key) => {
    models[key] = await getDynamooseModel(key, databaseServiceConfig.entities[key])
  })

  /**
   * Performs a search in the specified table by the provided search options
   *
   * @param {String} tableName The name of the table on which to search
   * @param {Object} searchOptions The search parameters object, it should have a json format with key/values
   *                               The key is the field name and the value is the parameter value to search by
   * @returns Promise([]) of an array containing the records that match the search parameters
   */
  dynamoDbService.search = async (tableName, searchOptions) => {
    const span = await logger.startSpan('dynamoDbService.search')
    const res = await new Promise((resolve, reject) => {
      models[tableName].scan(searchOptions).exec((err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result.count === 0 ? [] : result)
        }
      })
    })
    await logger.endSpan(span)
    return res
  }

  /**
   * Get all data collection (avoid default page limit of DynamoDB) by scan parameters
   * @param {Object} modelName The dynamoose model name
   * @param {Object} scanParams The scan parameters object
   * @returns {Array}
   */
  dynamoDbService.searchAll = async (modelName, scanParams) => {
    const span = await logger.startSpan('dynamoDbService.searchAll')
    let results = await models[modelName].scan(scanParams).exec()
    let lastKey = results.lastKey
    while (!_.isUndefined(results.lastKey)) {
      const newResult = await models[modelName].scan(scanParams).startAt(lastKey).exec()
      results = [...results, ...newResult]
      lastKey = newResult.lastKey
    }
    await logger.endSpan(span)
    return results
  }

  /**
   * Gets a document by id
   *
   * @param {String} tableName The table name in which to perform the search
   * @param {String} id The id value to search by
   * @throws NotFoundError if the record with the given id does not exist in the database
   * @returns Promise of the found record
   */
  dynamoDbService.getById = async (tableName, id) => {
    const span = await logger.startSpan('dynamoDbService.getById')
    const res = await new Promise((resolve, reject) => {
      models[tableName]
        .query('id')
        .eq(id)
        .exec((err, result) => {
          if (err) {
            reject(err)
          } else if (result.length > 0) {
            resolve(result[0])
          } else {
            reject(
              new errors.NotFoundError(
                `${tableName} with id: ${id} doesn't exist`
              )
            )
          }
        })
    })
    await logger.endSpan(span)
    return res
  }

  /**
   * Gets a document by hash key
   *
   * @param {String} tableName The table name in which to perform the search
   * @param {String} hashKeyValue The hash key value to search by
   * @param {String} hashKeyName The name of the hash key, default value is 'id'
   * @param {boolean} throwErrorIfNotFound whether to throw an error if the record is not found
   *                  If it is false and the record is not found, then it resolves to null
   * @returns Promise of the found record
   */
   dynamoDbService.getByHashKey = async (tableName, hashKeyValue, hashKeyName, throwErrorIfNotFound) => {
    const span = await logger.startSpan('dynamoDbService.getByHashKey')
    if(_.isUndefined(hashKeyName)) {
      hashKeyName = 'id'
    }
    const res = await new Promise((resolve, reject) => {
      models[tableName]
        .query(hashKeyName)
        .eq(hashKeyValue)
        .exec((err, result) => {
          if (err) {
            reject(err)
          } else if (result.length > 0) {
            resolve(result[0])
          } else {
            if(throwErrorIfNotFound) {
              reject(
                new errors.NotFoundError(
                  `${tableName} with hashKeyName: ${hashKeyValue} doesn't exist`
                )
              )
            } else {
              resolve(null)
            }
          }
        })
    })
    await logger.endSpan(span)
    return res
  }

  /**
 * Get Data by model ids
 * @param {String} modelName The dynamoose model name
 * @param {Array} ids The ids
 * @returns {Promise<Array>} the found entities
 * @throws {Error} If any of the ids is not found in the database
 */
  dynamoDbService.getByIds = async (modelName, ids) => {
    const span = await logger.startSpan('dynamoDbService.getByIds')
    const entities = []
    const theIds = ids || []
    for (const id of theIds) {
      entities.push(await dynamoDbService.getById(modelName, id))
    }
    await logger.endSpan(span)
    return entities
  }

/**
 * Searches by hashkeys
 * If any hash key is not present in the database, it is ignored and not added to the results
 * 
 * @param {String} modelName The model name
 * @param {Array} hashKeys The hash keys values to search by
 * @param {String} hashKeyName The name of the hash key field
 * @returns The list of records matching the specified hash keys values
 */
  dynamoDbService.searchByHashKeys = async (modelName, hashKeys, hashKeyName) => {
    const span = await logger.startSpan('dynamoDbService.searchByHashKeys')
    const entities = []
    const theHashKeys = hashKeys || []
    for (const key of theHashKeys) {
        const entity = await dynamoDbService.getByHashKey(modelName, key, hashKeyName, false)
        if(!_.isNull(entity)) {
          entities.push(entity)
        }
    }
    await logger.endSpan(span)
    return entities
  }

  /**
   * Check if the records matched by the given parameters already exist
   * @param {Object} tableName The table name in which to check for duplicate records
   * @param {String} keys The attributes names of table to check
   * @param {String} values The attributes values to be validated
   */
  dynamoDbService.validateDuplicate = async (tableName, keys, values) => {
    const span = await logger.startSpan('dynamoDbService.validateDuplicate')
    const options = {}
    if (Array.isArray(keys)) {
      if (keys.length !== values.length) {
        const error = new errors.BadRequestError(`size of ${keys} and ${values} do not match.`)
        await logger.endSpanWithError(span, error)
        throw error
      }

      keys.forEach(function (key, index) {
        options[key] = { eq: values[index] }
      })
    } else {
      options[keys] = { eq: values }
    }

    const records = await dynamoDbService.search(tableName, options)
    if (records.length > 0) {
      if (Array.isArray(keys)) {
        let str = `${tableName} with [ `

        for (const i in keys) {
          const key = keys[i]
          const value = values[i]

          str += `${key}: ${value}`
          if (i < keys.length - 1) {
            str += ', '
          }
        }
        const error = new errors.ConflictError(`${str} ] already exists`)
        await logger.endSpanWithError(span, error)

        throw error
      } else {
        const error = new errors.ConflictError(`${tableName} with ${keys}: ${values} already exists`)
        await logger.endSpanWithError(span, error)
        throw error
      }
    }
    await logger.endSpan(span)
  }

  /**
   * Create item in the specified table with the given data values
   *
   * @param {Object} tableName The table name in which to create the record
   * @param {Object} data The data of the object to create
   * @returns created record
   */
  dynamoDbService.create = async (tableName, data) => {
    const span = await logger.startSpan('dynamoDbService.create')
    const res = await new Promise((resolve, reject) => {
      const dbItem = new models[tableName](data)
      dbItem.save((err) => {
        if (err) {
          reject(err)
        } else {
          resolve(dbItem)
        }
      })
    })
    await logger.endSpan(span)
    return res
  }

  /**
   * Update item in database
   * @param {Object} dbItem The Dynamo database item
   * @param {Object} data The updated data object
   * @returns updated entity
   */
  dynamoDbService.update = async (dbItem, data) => {
    const span = await logger.startSpan('dynamoDbService.update')
    Object.keys(data).forEach((key) => {
      dbItem[key] = data[key]
    })
    const res = await new Promise((resolve, reject) => {
      dbItem.save((err) => {
        if (err) {
          reject(err)
        } else {
          resolve(dbItem)
        }
      })
    })
    await logger.endSpan(span)
    return res
  }

  /**
   * Delete an item in database
   * @param {Object} dbItem The Dynamo database item to remove
   */
  dynamoDbService.remove = async (dbItem) => {
    const span = await logger.startSpan('dynamoDbService.remove')
    const res = await new Promise((resolve, reject) => {
      dbItem.delete((err) => {
        if (err) {
          reject(err)
        } else {
          resolve(dbItem)
        }
      })
    })
    await logger.endSpan(span)
    return res
  }

  logger.buildService(dynamoDbService)

  return dynamoDbService
}

/**
 * This is a helper function which generates the Dynamoose model from the given model name and entity.
 * The model name is the table name
 *
 * The entity should have the following format:
 * const Entity = {
  fields: {
    field1: {
      field1Option1: field1Value1,
      field1Option2: field1Value2,
      ...

    },
    field2: {
      field2Option1: field2Value1,
      field2Option2: field2Value2,
      ...

    }
  },
  options: { // See schema options at https://v1.dynamoosejs.com/api/schema/#schema-options
    throughput: {
      read: 10,
      write: 5
    }
  }
}

For example, a Country entity can be defined like:
const Country = {
  fields: {
    id: {
      type: String,
      hashKey: true,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    countryFlag: {
      type: String,
      required: true
    },
    countryCode: {
      type: String,
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  options: {
    throughput: {
      read: 10,
      write: 5
    }
  }
}

 * @param {String} modelName The model name
 * @param {Object} entity The entity for which to generate the Dynamoose model
 * @returns The Dynamoose model for the given entity
 */
const getDynamooseModel = (modelName, entity) => {
  const schema = new Schema(
    {
      ..._.get(entity, 'fields')
    },
    _.get(entity, 'options')
  )

  return dynamoose.model(modelName, schema)
}
