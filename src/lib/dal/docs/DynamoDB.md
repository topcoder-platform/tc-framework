# Exposed APIs for DynamoDB:

| Function                                     | Description |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| search (tableName, searchOptions)            | Performs a search in the specified table by the provided search options. More details about how to construct the filter options can be found at https://v1.dynamoosejs.com/api/scan/ - This function is subject to DynamoDB limitation of a maximum of 1MB of data to be returned, to bypass this limitation use searchAll() instead                                              |
| searchAll (tableName, searchOptions)            | Performs a search in the specified table. This function bypasses the maximum limit of 1MB of data limit set by DynamoDB, it iterates over all the results in the table                                              |
| getByHashKey (tableName, hashKeyValue, hashKeyName, throwErrorIfNotFound)                      | Gets a document by hash key, this is a convenience function to use when the hash key name is not 'id', it also supports throwing a NotFoundError or returning null if the record does not exist based on the input patrameter throwErrorIfNotFound                                                     |
| searchByHashKeys (modelName, hashKeys,hashKeyName) | Performs a search by hash keys, if any hash key of the input hashKeys does not exist, it is ignored                                                          |
| getById (tableName, id)                      | Gets a document by id                                                         |
| getByIds (tableName, ids)                      | Gets a list of documents matching the given ids                             |
| validateDuplicate (tableName, keys, values)  | Check if the records matched by the given parameters already exist            |
| create (tableName, data)                     | Create item in the specified table with the given data values                 |
| update (dbItem, data)                        | Update item in database                                                       |
| remove (dbItem)                              | Delete item in database                                                       |

# Dynamoose v1 vs Dynamoose v2:
This DAL uses Dynamoose v1 to access the DynamoDB database.

The reason for using Dynamoose v1 is that almost all Topcoder applications use v1.

The switch to Dynamoose v2 have some breaking changes which may break running applications.

# Dynamo DB Usage example:
## Configuration:
The following confguration parameters need to be provided to get the DynamoDB service instance:
```javascript
databaseService = require('tc-framework').dal.getDatabaseService('DynamoDb', databaseServiceConfig)
```

The format of the configObject is:
```javascript
  const configObject = {
    isLocalDB: config.AMAZON.IS_LOCAL_DB,
    localDatabaseURL: config.AMAZON.DYNAMODB_URL,
    dynamooseDefaults: { // Dynamoose defaults, see https://v1.dynamoosejs.com/api/config/#dynamoosesetdefaultsoptions for details
      create: false,
      update: false,
      waitForActive: false
    },
    entities : entities
  }
```

| Configuration parameter     | Description                                                         |
| --------------------------- | --------------------------------------------------------------------|
| Database type               | The database type value should be 'DynamoDb'                        |
|isLocalDB                    | This flag indicates whether a local database is used or no          |
|localDatabaseURL             | The URL of the local database, required when isLocalDB== true       |
|dynamooseDefaults            | The global default parameters for Dynamoose. for more details refer to https://v1.dynamoosejs.com/api/config/#dynamoosesetdefaultsoptions                                                                        |
|entities                     | This object holds the entities to be managed by the DAL. The key is the table name and the value is the entity definition                                                                                          |


## Entities:
The entities to be managed in DynamoDB by this DAL should have the following format:
```javascript
const Entity = {
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
```

For example:

`Country.js`
```javascript
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
module.exports = Country
```

`EducationalInstitution.js`
```javascript
const EducationalInstitution = {
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

module.exports = EducationalInstitution
```

Construct the entities object to pass to the DAL
```javascript
const entities = {}
entities['countries'] = require('./Country')
entities['educational_institutions'] = require('./EducationalInstitution')

module.exports = entities
```

Get the DynamoDBService instance:

```javascript
function getDatabaseServiceInstance () {
  if (databaseService) {
    return databaseService
  }
  // See supported aws config at: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property

  const databaseServiceConfig = {
    isLocalDB: true,
    localDatabaseURL: 'http://localhost:8000',
    dynamooseDefaults: { // Dynamoose defaults, see https://v1.dynamoosejs.com/api/config/#dynamoosesetdefaultsoptions for details
      create: false,
      update: false,
      waitForActive: false
    },
    entities : entities // The entities object constructed above
  }

  databaseService = require('tc-framework').dal.getDatabaseService('DynamoDb', databaseServiceConfig)
  return databaseService
}
```

Manage entities using the retrieved instance
```javascript
const databaseService = await getDatabaseServiceInstance()

// More details about how to construct the filter options can be found at https://v1.dynamoosejs.com/api/scan/
const allCountries = await databaseService.search('countries', {})
const allNonDeletedCountries = await databaseService.search('countries', {isDeleted: {eq: true}})

// validate duplicate
// This will throw a Conflict error if a record with name = 'United States' and countryCode = 'USA' already exists in the database
await databaseService.validateDuplicate('countries', ['name', 'countryCode'], ['United States', 'USA'])

// create a new country
const canada = await databaseService.create('countries', {
  name: 'Canada',
  countryFlag: 'https://commons.wikimedia.org/wiki/File:Flag_of_Canada.svg',
  countryCode: 'CAN',
  isDeleted: false
  })

// find by id
const retrievedById = await databaseService.getById('countries', canada.id)


// Update the country code
const updated = await databaseService.update(retrievedById, {countryCode: 'CA'})
```