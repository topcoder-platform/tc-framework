const { trace } = require('@opentelemetry/api')
const { SimpleSpanProcessor, BatchSpanProcessor, BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const { Resource } = require('@opentelemetry/resources')
const { WinstonInstrumentation } = require('@opentelemetry/instrumentation-winston')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')

module.exports = (config) => {
  const exporter = new OTLPTraceExporter({
    url: config.APM_OTLP_TRACE_EXPORTER_URL
  })

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.APM_SERVICE_NAME
    })
  })
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
  provider.addSpanProcessor(new BatchSpanProcessor(new BatchSpanProcessor(exporter)))
  // provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))
  provider.register()

  registerInstrumentations({
    instrumentations: [
      new WinstonInstrumentation()
    ]
  })

  return trace.getTracer(config.APM_TRACER_NAME)
}
