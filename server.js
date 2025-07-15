const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')

const app = express()

// Tillåt alla origins (kan begränsas senare)
app.use(cors({
  origin: '*'
}))

const clientId = process.env.TWITCH_CLIENT_ID || 'DIN_TWITCH_CLIENT_ID'
const clientSecret = process.env.TWITCH_SECRET || 'DITT_TWITCH_CLIENT_SECRET'

let accessToken = ''
let tokenExpiresAt = 0

// Funktion för att hämta access token från Twitch
async function getAccessToken() {
  if (Date.now() < tokenExpiresAt) return accessToken

  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('client_secret', clientSecret)
  params.append('grant_type', 'client_credentials')

  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: params
    })

    if (!res.ok) {
      throw new Error(`Twitch token fetch failed: ${res.status}`)
    }

    const data = await res.json()
    accessToken = data.access_token
    tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000 // förnya 1 min innan utgång
    return accessToken
  } catch (e) {
    console.error('Fel vid hämtning av Twitch token:', e)
    throw e
  }
}

// Funktion för att kolla live-status för flera streamers
async function checkStreamers(userLogins) {
  const token = await getAccessToken()
  const url = `https://api.twitch.tv/helix/streams?${userLogins.map(u => 'user_login=' + u).join('&')}`

  try {
    const res = await fetch(url, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`
      }
    })

    if (!res.ok) {
      throw new Error(`Twitch streams fetch failed: ${res.status}`)
    }

    const data = await res.json()

    // Bygg en karta med user_login -> live status
    const liveMap = {}
    userLogins.forEach(u => liveMap[u.toLowerCase()] = false)
    data.data.forEach(stream => {
      liveMap[stream.user_login.toLowerCase()] = true
    })
    return liveMap
  } catch (e) {
    console.error('Fel vid hämtning av streams:', e)
    throw e
  }
}

// API-endpoint för att hämta status för flera streamers på en gång
app.get('/stream-status', async (req, res) => {
  const streamers = ['aienia', 'polackentv', 'lillibells']
  try {
    const statuses = await checkStreamers(streamers)
    res.json(statuses)
  } catch (e) {
    res.status(500).json({ error: 'Något gick fel vid hämtning av stream-status' })
  }
})

// Kontroll-route
app.get('/', (req, res) => {
  res.send('Streamkungen server är online!')
})

// Port från miljövariabel, som Render kräver
const PORT = process.env.PORT
if (!PORT) {
  console.error('PORT är inte satt i miljön! Avbryter.')
  process.exit(1)
}

app.listen(PORT, () => console.log(`Servern snurrar på port ${PORT}`))
