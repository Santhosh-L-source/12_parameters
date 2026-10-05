const crypto = require('crypto');
const sequelize = require('../config/database');

/**
 * Middleware: Authenticate third-party applications via x-api-key or Bearer token
 * Logs every API request to external_api_logs
 */
async function authenticateExternalApiKey(req, res, next) {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-api-token'];
  let rawToken = apiKeyHeader;

  if (!rawToken && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'ApiKey')) {
      rawToken = parts[1];
    }
  }

  if (!rawToken) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key is required. Provide via x-api-key header or Authorization: Bearer <KEY>'
    });
  }

  try {
    const keyHash = crypto.createHash('sha256').update(String(rawToken).trim()).digest('hex');

    const keyRecords = await sequelize.query(
      `SELECT key_id, client_name, is_active, rate_limit_rpm, permissions 
       FROM api_keys 
       WHERE key_hash = :keyHash AND is_active = true 
       LIMIT 1`,
      { replacements: { keyHash }, type: sequelize.QueryTypes.SELECT }
    );

    if (!keyRecords || keyRecords.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Invalid or deactivated API key.'
      });
    }

    const client = keyRecords[0];
    req.externalClient = client;

    // Log request asynchronously on response completion
    res.on('finish', () => {
      const endpoint = req.originalUrl || req.baseUrl + req.path;
      const responseStatus = res.statusCode;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const sanitizedParams = {
        query: req.query,
        params: req.params,
        bodyRollNumbers: req.body?.roll_numbers ? `${req.body.roll_numbers.length} items` : undefined
      };

      sequelize.query(
        `INSERT INTO external_api_logs 
         (key_id, client_name, endpoint, params, response_status, ip_address, called_at)
         VALUES (:keyId, :clientName, :endpoint, :params::jsonb, :status, :ip, NOW())`,
        {
          replacements: {
            keyId: client.key_id,
            clientName: client.client_name,
            endpoint,
            params: JSON.stringify(sanitizedParams),
            status: responseStatus,
            ip: String(ipAddress).substring(0, 50)
          },
          type: sequelize.QueryTypes.INSERT
        }
      ).catch((err) => console.error('[ExternalAuth] Log error:', err.message));
    });

    next();
  } catch (err) {
    console.error('[ExternalAuth] Auth error:', err.message);
    return res.status(500).json({ success: false, error: 'Authentication internal error' });
  }
}

module.exports = { authenticateExternalApiKey };
