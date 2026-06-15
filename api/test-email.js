'use strict';
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

module.exports = async function handler(req, res) {
  const to = req.query.to || req.body?.to;
  if (!to) return res.status(400).json({ error: 'Pass ?to=email@example.com' });

  const ses = new SESClient({
    region: process.env.AWS_SES_REGION || 'us-east-2',
    credentials: {
      accessKeyId:     process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });

  try {
    const result = await ses.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL || 'noreply@admexo.com',
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: '✅ SES Test — AI Lead Engine' },
        Body: {
          Html: { Data: '<h2>SES is working!</h2><p>This is a test email from your AI Lead Engine backend.</p>' },
          Text: { Data: 'SES is working! This is a test email from your AI Lead Engine backend.' },
        },
      },
    }));

    return res.json({ ok: true, messageId: result.MessageId });
  } catch (err) {
    console.error('[test-email]', err);
    return res.status(500).json({ error: err.message, code: err.name });
  }
};
