let responseHeaders = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'content-type': 'application/json;charset=UTF-8',
})

async function findGuest(submission) {
  const email = submission.email

  const params = {
    filterByFormula: '{Email}="' + email + '"',
  }

  const url =
    'https://api.airtable.com/v0/appiPHOcdGktaFlGE/Guests?' +
    new URLSearchParams(params)

  let headers = new Headers()
  headers.append('Authorization', AIRTABLE_API_KEY)
  headers.append('Content-Type', 'application/json')

  const requestOptions = {
    method: 'GET',
    headers: headers,
    redirect: 'follow',
  }
  const response = await fetch(url, requestOptions)
  const rj = await response.json()
  const records = rj.records
  // console.log(JSON.stringify(rj))
  return records
}

async function sendEmail(submission) {
  const url = 'https://api.sendgrid.com/v3/mail/send'

  let headers = new Headers()
  headers.append('Authorization', SENDGRID_API_KEY)
  headers.append('Content-Type', 'application/json')

  const data = {
    personalizations: [
      {
        to: [
          {
            email: 'johnson.philip.louis@gmail.com',
            name: 'Philip Johnson',
          },
        ],
      },
    ],
    from: {
      email: 'alerts@danielleandphilip.com',
      name: 'alerts',
    },
    replyTo: {
      email: 'alerts@danielleandphilip.com',
      name: 'Philip Johnson',
    },

    subject: submission.email + ' has replied to your save the date',
    content: [
      {
        type: 'text/plain',
        value: JSON.stringify(submission),
      },
    ],
  }

  const requestOptions = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data),
    redirect: 'follow',
  }

  try {
    const response = await fetch(url, requestOptions)
    const rj = await response.text
    return rj
  } catch (e) {
    console.log(JSON.stringify(e))
  }
}

async function createGuest(submission) {
  const email = submission.email

  const url = 'https://api.airtable.com/v0/appiPHOcdGktaFlGE/Guests'

  let headers = new Headers()
  headers.append('Authorization', AIRTABLE_API_KEY)
  headers.append('Content-Type', 'application/json')

  const data = {
    records: [
      {
        fields: {
          Email: email,
          'Guest Names': submission.firstName + ' ' + submission.lastName,
          'Indicated Liklihood': submission.selectedOption,
        },
      },
    ],
  }

  const requestOptions = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data),
    redirect: 'follow',
  }
  const response = await fetch(url, requestOptions)
  const rj = await response.json()
  const records = rj.records
  // console.log(JSON.stringify(rj))
  return records
}

async function checkExistingResponse(records) {
  const existingResponses = records.filter(
    record => typeof record.fields['Indicated Liklihood'] == 'number',
  )
  return existingResponses
}

async function createAddress(submission) {
  const data = {
    records: [
      {
        fields: {
          'Address 1': submission.streetAddress,
          'Address 2': submission.streetAddress2,
          City: submission.city,
          Region: submission.region,
          'Postal Code': submission.postalCode,
          Country: submission.country,
        },
      },
    ],
  }

  // console.log(data)

  const url = 'https://api.airtable.com/v0/appiPHOcdGktaFlGE/Mailing%20Address'

  let headers = new Headers()
  headers.append('Authorization', AIRTABLE_API_KEY)
  headers.append('Content-Type', 'application/json')

  const requestOptions = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data),
    redirect: 'follow',
  }
  const response = await fetch(url, requestOptions)
  const rj = await response.json()
  // print(JSON.stringify(rj))
  const recordIds = rj.records.map(record => record.id)
  // console.log(JSON.stringify(recordIds))
  return recordIds
}

async function updateRSVP(records, newAddress, submission) {
  const recordsUpdate = records.map(record => {
    return {
      id: record.id,
      fields: {
        'Indicated Liklihood': submission.selectedOption,
        'Mailing Address': newAddress,
      },
    }
  })

  const data = {
    records: recordsUpdate,
  }

  // console.log(JSON.stringify(data))

  const url = 'https://api.airtable.com/v0/appiPHOcdGktaFlGE/Guests'

  let headers = new Headers()
  headers.append('Authorization', AIRTABLE_API_KEY)
  headers.append('Content-Type', 'application/json')

  const requestOptions = {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(data),
    redirect: 'follow',
  }
  const response = await fetch(url, requestOptions)
  const rj = await response.json()
  // console.log(JSON.stringify(rj))
  return rj
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  const requestUrl = new URL(request.url)
  const path = requestUrl.pathname

  const submission = await request.json()

  console.log(JSON.stringify(submission))

  // console.log(JSON.stringify(emailResult))

  // Root Path Logic
  if (path == '/') {
    // console.log(JSON.stringify(request))
    await sendEmail(submission)
    // console.log(JSON.stringify(newAddress))
    const guests = await findGuest(submission)

    if (guests.length < 1) {
      console.log('Guest not found. Creating new guest')
      const newGuest = await createGuest(submission)
      const newAddress = await createAddress(submission)
      // console.log(JSON.stringify(newGuest), JSON.stringify(newAddress))
      const updates = await updateRSVP(newGuest, newAddress, submission)
    } else {
      console.log('Found existing guest')
      const newAddress = await createAddress(submission)
      const updates = await updateRSVP(guests, newAddress, submission)
    }

    return new Response('true', {
      status: 200,
      headers: responseHeaders,
    })
  }

  if (path == '/response') {
    const guests = await findGuest(submission)
    const existingResponses = await checkExistingResponse(guests)
    const ej = JSON.stringify(existingResponses)

    return new Response(existingResponses.length > 0 ? ej : false, {
      status: 200,
      headers: responseHeaders,
    })
  }

  if (path == '/guest') {
    const guests = await findGuest(submission)
    const ej = JSON.stringify(guests)

    return new Response(guests.length > 0 ? ej : false, {
      status: 200,
      headers: responseHeaders,
    })
  }
}
