const config = require('config')
const logger = require('tc-framework').logger(config)
const axios = require('axios')

let service

async function delay (ms) {
  await new Promise((r) => {
    setTimeout(() => r(), ms)
  })
}

async function getM2mToken () {
  await delay(100)
}

getM2mToken.apm = true

async function readFromES () {
  // This is mock and instead of ES it's using the Topcoder Challenge API to fetch data
  return await axios.get('http://api.topcoder-dev.com/v5/challenges')
}

readFromES.apm = true

async function getChallenges () {
  await service.getM2mToken()
  const {data} = await service.readFromES()
  return data
}

getChallenges.apm = true

service = {
  getM2mToken,
  getChallenges,
  readFromES
}

logger.buildService(service)

module.exports = service
