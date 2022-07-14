const express = require('express')
const service = require('./service')
const app = express()

app.get('/challenges', async (req, res) => {
  try {
    res.json(await service.getChallenges())
  } catch (e) {
    console.log(e)
    res.json({ success: false })
  }
})

app.listen(8080, () => console.log('API running on http://localhost:8080'))
