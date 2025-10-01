const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const requestData = JSON.parse(event.body);
    const { code, refresh_token, grant_type } = requestData;

    // Validate input
    if (!grant_type || (grant_type === 'authorization_code' && !code) || 
        (grant_type === 'refresh_token' && !refresh_token)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Get secrets from environment variables
    const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
    const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('Missing environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Prepare request to Strava
    const stravaRequestBody = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: grant_type
    };

    if (grant_type === 'authorization_code') {
      stravaRequestBody.code = code;
    } else if (grant_type === 'refresh_token') {
      stravaRequestBody.refresh_token = refresh_token;
    }

    // Exchange with Strava
    const stravaResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(stravaRequestBody)
    });

    const stravaData = await stravaResponse.json();

    if (!stravaResponse.ok) {
      console.error('Strava API error:', stravaData);
      return {
        statusCode: stravaResponse.status,
        headers,
        body: JSON.stringify({
          error: stravaData.message || 'Strava authentication failed',
          details: stravaData
        })
      };
    }

    // Return tokens to client (without exposing CLIENT_SECRET)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: stravaData.access_token,
        refresh_token: stravaData.refresh_token,
        expires_at: stravaData.expires_at,
        expires_in: stravaData.expires_in,
        athlete: stravaData.athlete
      })
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