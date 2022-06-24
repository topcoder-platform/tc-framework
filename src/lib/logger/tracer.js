const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor, ConsoleSpanExporter, BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
// const { registerInstrumentations } = require('@opentelemetry/instrumentation');
// const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { Resource } = require('@opentelemetry/resources');


module.exports = (config) => {
 const resources = new Resource({
    'service.name': config.Service_NAME,
    'application': config.APPLICATION_NAME,
    //'ANY_OTHER_ATTRIBUTE_KEY': 'ANY_OTHER_ATTRIBUTE_VALUE',
 }); 

 const provider = new NodeTracerProvider({ resource: resources })
 
 const exporterOptions = {
   url: config.EXPORTER_URL,
 }


 const exporter = new OTLPTraceExporter(exporterOptions);
 provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
 provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
 provider.addSpanProcessor(new BatchSpanProcessor(new exporter()))
 provider.register();

//  registerInstrumentations({
//   instrumentations: [
//     new HttpInstrumentation(),
//   ],
//  })
 return opentelemetry.trace.getTracer("instrumentation-example");
}