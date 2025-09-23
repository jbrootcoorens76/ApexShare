const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'apexshare-uploads-prod';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || 'https://apexshare.be',
  'Access-Control-Allow-Headers': 'Content-Type,X-Requested-With,Authorization,X-Auth-Token,X-Public-Access',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// JWT validation helper (simplified for now)
function validateToken(event) {
  // First check X-Auth-Token header (fallback for custom domain issues)
  const xAuthToken = event.headers?.['X-Auth-Token'] || event.headers?.['x-auth-token'];
  if (xAuthToken) {
    // For now, just return a mock user - in production, verify JWT
    return { userId: 'trainer@apexshare.be', role: 'trainer' };
  }

  // Check X-Public-Access header for frontend compatibility
  const publicAccess = event.headers?.['X-Public-Access'] || event.headers?.['x-public-access'];
  if (publicAccess === 'true') {
    return { userId: 'public-user@apexshare.be', role: 'public' };
  }

  // Then check standard Authorization header
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

// List sessions with pagination and filtering
async function listSessions(queryParams) {
  try {
    // Handle null queryParams
    const params = queryParams || {};
    const limit = parseInt(params.limit) || 10;
    const offset = parseInt(params.offset) || 0;

    // For now, return mock data that matches frontend expectations
    const mockSessions = [
      {
        id: uuidv4(),
        studentName: 'John Doe',
        studentEmail: 'john.doe@example.com',
        sessionDate: '2025-01-20',
        status: 'completed',
        createdAt: '2025-01-20T10:00:00Z',
        uploadCount: 2,
        lastActivity: '2025-01-20T14:30:00Z'
      },
      {
        id: uuidv4(),
        studentName: 'Jane Smith',
        studentEmail: 'jane.smith@example.com',
        sessionDate: '2025-01-19',
        status: 'pending',
        createdAt: '2025-01-19T09:00:00Z',
        uploadCount: 1,
        lastActivity: '2025-01-19T16:45:00Z'
      },
      {
        id: uuidv4(),
        studentName: 'Mike Johnson',
        studentEmail: 'mike.johnson@example.com',
        sessionDate: '2025-01-18',
        status: 'completed',
        createdAt: '2025-01-18T11:30:00Z',
        uploadCount: 3,
        lastActivity: '2025-01-18T15:20:00Z'
      }
    ];

    const paginatedSessions = mockSessions.slice(offset, offset + limit);

    return createResponse(200, {
      success: true,
      data: {
        sessions: paginatedSessions,
        pagination: {
          total: mockSessions.length,
          limit,
          offset,
          hasMore: offset + limit < mockSessions.length
        }
      }
    });

  } catch (error) {
    console.error('Error listing sessions:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve sessions'
      }
    });
  }
}

// Get specific session by ID
async function getSession(sessionId) {
  try {
    // Mock single session data
    const session = {
      id: sessionId,
      studentName: 'John Doe',
      studentEmail: 'john.doe@example.com',
      trainerName: 'Instructor Smith',
      sessionDate: '2025-01-20',
      status: 'completed',
      notes: 'Highway riding session - excellent progress',
      createdAt: '2025-01-20T10:00:00Z',
      updatedAt: '2025-01-20T14:30:00Z',
      uploads: [
        {
          fileId: uuidv4(),
          fileName: 'highway-session-1.mp4',
          uploadedAt: '2025-01-20T14:30:00Z',
          status: 'ready'
        }
      ]
    };

    return createResponse(200, {
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Error getting session:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve session'
      }
    });
  }
}

// Create new session
async function createSession(sessionData) {
  try {
    // Enhanced logging for debugging
    console.log('Received session data:', JSON.stringify(sessionData, null, 2));

    // Handle both frontend format and direct format
    // The frontend sends: { title, description, studentEmails, isPublic, metadata }
    // We need to transform this into the expected backend format
    let processedData = {};

    if (sessionData.studentEmails && Array.isArray(sessionData.studentEmails)) {
      // Frontend format - transform it
      processedData = {
        studentName: sessionData.metadata?.studentName || 'Unknown Student',
        studentEmail: sessionData.studentEmails[0] || 'no-email@example.com',
        trainerName: sessionData.metadata?.trainerName || 'Unknown Trainer',
        sessionDate: sessionData.metadata?.date || new Date().toISOString().split('T')[0],
        notes: sessionData.description || sessionData.metadata?.notes || '',
        title: sessionData.title || 'Training Session',
        isPublic: sessionData.isPublic || false,
        metadata: sessionData.metadata || {}
      };
    } else {
      // Direct format - use as is
      processedData = sessionData;
    }

    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      ...processedData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploadCount: 0
    };

    // In production, save to DynamoDB here
    console.log('Creating session with ID:', sessionId);
    console.log('Full session object:', JSON.stringify(session, null, 2));

    const response = {
      success: true,
      data: session
    };

    console.log('Returning response:', JSON.stringify(response, null, 2));

    return createResponse(201, response);

  } catch (error) {
    console.error('Error creating session:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create session'
      }
    });
  }
}

// Update existing session
async function updateSession(sessionId, updateData) {
  try {
    const updatedSession = {
      id: sessionId,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    // In production, update in DynamoDB here
    console.log('Updating session:', updatedSession);

    return createResponse(200, {
      success: true,
      data: updatedSession
    });

  } catch (error) {
    console.error('Error updating session:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update session'
      }
    });
  }
}

// Delete session
async function deleteSession(sessionId) {
  try {
    // In production, delete from DynamoDB here
    console.log('Deleting session:', sessionId);

    return createResponse(200, {
      success: true,
      data: {
        message: 'Session deleted successfully',
        sessionId
      }
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete session'
      }
    });
  }
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Sessions handler event:', JSON.stringify(event, null, 2));

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

  const { httpMethod, pathParameters, queryStringParameters, body } = event;

  try {
    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.sessionId) {
          return await getSession(pathParameters.sessionId);
        } else {
          return await listSessions(queryStringParameters);
        }

      case 'POST':
        const createData = body ? JSON.parse(body) : {};
        return await createSession(createData);

      case 'PUT':
        if (!pathParameters?.sessionId) {
          return createResponse(400, {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Session ID is required for updates'
            }
          });
        }
        const updateData = body ? JSON.parse(body) : {};
        return await updateSession(pathParameters.sessionId, updateData);

      case 'DELETE':
        if (!pathParameters?.sessionId) {
          return createResponse(400, {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Session ID is required for deletion'
            }
          });
        }
        return await deleteSession(pathParameters.sessionId);

      default:
        return createResponse(405, {
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `HTTP method ${httpMethod} is not supported`
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