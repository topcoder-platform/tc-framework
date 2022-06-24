# Topcoder Logging library

This is the library tha provides outo joi validation and outo and apm instrumentation

## Configuration

The following parameters can be set in config files or in env variables:

- LOG_LEVEL: the log level;
- Service_NAME: the service name
- APPLICATION_NAME: the application name
- EXPORTER_URL: the exporter url

## Examples

### Logging

```javascript
const logger = require('@topcoder-platform/tc-framework/logger')

// Info
logger.info('Information')

// debug
logger.debug('Debug message')

// warn
logger.warn('Warning message')

// error
logger.error('Error message')
```

### Joi validation

```javascript
const logger = require('@topcoder-platform/tc-framework/logger')
const Joi = require('@hapi/joi')

async function sampleFunction (data) {
  // do something
}

sampleFunction.schema = {
  data: Joi.object().keys({
    a: Joi.string().required(),
    b: Joi.number().min(0).max(100).required()
  }).required()
}

module.exports = {
  sampleFunction
}

logger.buildService(module.exports, 'application_name', 'application_version')
```

### Apm instrumentation

```javascript
const logger = require('@topcoder-platform/tc-framework/logger')

function testFunction (message) {
  // do something
}

testFunction.apm = true

module.exports = {
  testFunction
}

logger.buildService(module.exports, 'application_name', 'application_version')
```

