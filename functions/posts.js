export async function onRequest(context) {
  try {
    if (context.request.method === 'POST') {
      const MAX_SIZE = 5 * 1024 * 1024 // 5MB

      const json = await context.request.text()
      if (json.length > MAX_SIZE) {
        return new Response('File is too large', { status: 413 })
      }

      const key = `entry:${Date.now()}`
      await context.env.KV.put(key, json, {
        expirationTtl: 86400,
      }) // Store for 24 hours

      return new Response('Data uploaded successfully', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (context.request.method === 'GET') {
      const keys = await context.env.KV.list()
      const entries = []

      for (const { name } of keys.keys) {
        const timestamp = Number(name.split(':')[1])
        const json = await context.env.KV.get(name)
        if (json) {
          entries.push([timestamp, JSON.parse(json)])
        }
      }

      entries.sort((a, b) => b[0] - a[0]) // Sort by timestamp, newest first

      const values = entries.map((entry) => JSON.stringify(entry[1]))

      return new Response(JSON.stringify(values), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (context.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (e) {
    console.error('Error handling request:', e)
    return new Response(
      `Internal Server Error\n${JSON.stringify(
        e instanceof Error ? e.message : e
      )}`,
      { status: 500 }
    )
  }
}
