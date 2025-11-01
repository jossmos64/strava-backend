const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const { endpoint, bbox, zoom, x, y } = queryParams;

    // Get Mapillary token from environment variable
    const MAPILLARY_TOKEN = process.env.MAPILLARY_CLIENT_TOKEN;

    if (!MAPILLARY_TOKEN) {
      console.error('Missing MAPILLARY_CLIENT_TOKEN environment variable');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    let mapillaryUrl;

    // Handle different endpoint types
    if (endpoint === 'images' && bbox) {
      // Images API endpoint
      mapillaryUrl = `https://graph.mapillary.com/images?fields=id,thumb_256_url,thumb_1024_url,thumb_2048_url,computed_geometry,compass_angle,captured_at,sequence&bbox=${bbox}&limit=2000`;
    } else if (endpoint === 'tiles' && zoom && x && y) {
      // Vector tiles endpoint
      mapillaryUrl = `https://tiles.mapillary.com/maps/vtp/mly1_public/2/${zoom}/${x}/${y}`;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid endpoint parameters' })
      };
    }

    console.log('Proxying request to Mapillary:', endpoint);

    // Make request to Mapillary
    const mapillaryResponse = await fetch(mapillaryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `OAuth ${MAPILLARY_TOKEN}`
      },
      timeout: 45000
    });

    // Handle non-JSON responses (like vector tiles)
    const contentType = mapillaryResponse.headers.get('content-type');
    let responseBody;
    let responseHeaders = { ...headers };

    if (contentType && contentType.includes('application/json')) {
      responseBody = await mapillaryResponse.text();
    } else {
      // For binary data (tiles)
      const buffer = await mapillaryResponse.buffer();
      responseHeaders['Content-Type'] = contentType || 'application/octet-stream';
      return {
        statusCode: mapillaryResponse.status,
        headers: responseHeaders,
        body: buffer.toString('base64'),
        isBase64Encoded: true
      };
    }

    if (!mapillaryResponse.ok) {
      console.error('Mapillary API error:', responseBody);
      return {
        statusCode: mapillaryResponse.status,
        headers,
        body: JSON.stringify({
          error: 'Mapillary API request failed',
          status: mapillaryResponse.status,
          details: responseBody
        })
      };
    }

    // Return successful response
    return {
      statusCode: 200,
      headers,
      body: responseBody
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};