const config = require('config')
const logger = require('tc-framework').logger(config)
const axios = require('axios')

async function delay (ms) {
  const span = await logger.startSpan('delay')
  await new Promise((r) => {
    setTimeout(() => r(), ms)
  })
  await logger.endSpan(span)
}

async function getM2mToken () {
  const span = await logger.startSpan('getM2mToken')
  await delay(100)
  await logger.endSpan(span)
}

async function readFromES () {
  const span = await logger.startSpan('readFromES')
  // This is mock and instead of ES it's using the Topcoder Challenge API to fetch data
  const data = await axios.get('http://api.topcoder-dev.com/v5/challenges')
  await logger.endSpan(span)
  return data
}

async function getChallenges () {
  const span = await logger.startSpan('getChallenges')
  await getM2mToken()
  const { data } = await readFromES()
  await logger.endSpan(span)
  return data
}

module.exports = {
  getM2mToken,
  getChallenges,
  readFromES
}

logger.buildService(module.exports)
