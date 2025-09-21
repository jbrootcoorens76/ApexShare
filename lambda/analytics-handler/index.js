const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'apexshare-uploads-prod';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || 'https://apexshare.be',
  'Access-Control-Allow-Headers': 'Content-Type,X-Requested-With,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

// JWT validation helper (simplified for now)
function validateToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  // For now, just return a mock user - in production, verify JWT
  return { userId: 'trainer@apexshare.be', role: 'trainer' };
}

// Create response helper
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

// Generate usage metrics for dashboard
async function getUsageMetrics(period = '30d') {
  try {
    // Parse period (30d, 7d, etc.)
    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Generate mock usage data that matches frontend expectations
    const mockMetrics = {
      totalSessions: 45,
      totalUploads: 87,
      totalDownloads: 156,
      totalStorage: '2.4 GB',
      activeStudents: 23,
      completionRate: '89%',
      averageSessionDuration: '45 min',
      period: period,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),

      // Daily breakdown for charts
      dailyStats: generateDailyStats(days),

      // Top performing metrics
      topStudents: [
        { name: 'John Doe', sessions: 8, downloads: 12 },
        { name: 'Jane Smith', sessions: 6, downloads: 9 },
        { name: 'Mike Johnson', sessions: 5, downloads: 8 }
      ],

      // Recent activity summary
      recentActivity: [
        {
          type: 'upload',
          student: 'John Doe',
          action: 'Uploaded highway session video',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
        },
        {
          type: 'download',
          student: 'Jane Smith',
          action: 'Downloaded parking practice video',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
        },
        {
          type: 'session',
          student: 'Mike Johnson',
          action: 'Created new training session',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() // 6 hours ago
        }
      ]
    };

    return createResponse(200, {
      success: true,
      data: mockMetrics
    });

  } catch (error) {
    console.error('Error getting usage metrics:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve usage metrics'
      }
    });
  }
}

// Generate daily stats for the specified number of days
function generateDailyStats(days) {
  const stats = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic but random-ish data
    const baseActivity = Math.floor(Math.random() * 10) + 1;

    stats.push({
      date: date.toISOString().split('T')[0],
      sessions: Math.floor(baseActivity * 0.8),
      uploads: Math.floor(baseActivity * 1.2),
      downloads: Math.floor(baseActivity * 1.8),
      activeUsers: Math.floor(baseActivity * 0.6)
    });
  }

  return stats;
}

// Track analytics events
async function trackEvent(eventData) {
  try {
    const { v4: uuidv4 } = require('uuid');
    const event = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      ...eventData
    };

    // In production, save event to DynamoDB or analytics service
    console.log('Tracking event:', event);

    // Return success response
    return createResponse(200, {
      success: true,
      data: {
        message: 'Event tracked successfully',
        eventId: event.eventId
      }
    });

  } catch (error) {
    console.error('Error tracking event:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to track event'
      }
    });
  }
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Analytics handler event:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, {});
  }

  // Validate authorization for non-OPTIONS requests
  const user = validateToken(event);
  if (!user) {
    return createResponse(401, {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid authorization token required'
      }
    });
  }

  const { httpMethod, path, queryStringParameters, body } = event;

  try {
    // Route based on path and method
    if (path.includes('/usage') && httpMethod === 'GET') {
      const period = queryStringParameters?.period || '30d';
      return await getUsageMetrics(period);
    }
    else if (path.includes('/events') && httpMethod === 'POST') {
      const eventData = body ? JSON.parse(body) : {};
      return await trackEvent(eventData);
    }
    else {
      return createResponse(404, {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analytics endpoint not found'
        }
      });
    }

  } catch (error) {
    console.error('Handler error:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
};