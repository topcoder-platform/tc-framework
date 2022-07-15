# Topcoder Logging library

This is the library tha provides auto joi validation and auto apm instrumentation

## Configuration

The following parameters can be set in config files or in env variables:

- LOG_LEVEL: the log level;
- APM_OTLP_TRACE_EXPORTER_URL: The OTLP Trace Exporter URL
- APM_SERVICE_NAME: the service name
- APM_TRACER_NAME: the tracer name

## Examples

### Logging

```javascript
const logger = require('tc-framework').logger(config)

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
const logger = require('tc-framework').logger(config)
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

logger.buildService(module.exports)
```

### Apm instrumentation

```javascript
const logger = require('tc-framework').logger(config)

async function testFunction (message) {
  const span = await logger.startSpan('testFunction')
  try {
    // do something
    await logger.endSpan(span)
  } catch (e) {
    await logger.endSpanWithError(span, e)
  }
}

module.exports = {
  testFunction
}

logger.buildService(module.exports)
```

