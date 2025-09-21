/**
 * Upload Handler Lambda Function
 *
 * Handles video upload initiation by:
 * 1. Validating request parameters
 * 2. Generating presigned S3 POST URLs
 * 3. Creating metadata records in DynamoDB
 * 4. Implementing security validations
 * 5. Providing structured error responses
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
/**
 * Main Lambda handler
 */
export declare const handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
