import https from 'https';

const CONFIG = {
  domain: 'project-forge.vercel.app',
  endpoints: [
    '/',
    '/api/health',
    '/dashboard',
    '/projects',
  ],
  envVars: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SITE_URL',
  ],
};

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            bodyPreview: data.substring(0, 200),
          });
        });
      })
      .on('error', reject)
      .on('timeout', () => {
        reject(new Error('Request timeout'));
      });
  });
}

async function verifyDeployment() {
  console.log('🚀 PROJECT-FORGE DEPLOYMENT VERIFICATION\n');
  console.log(`Domain: https://${CONFIG.domain}\n`);

  const report = {
    timestamp: new Date().toISOString(),
    domain: CONFIG.domain,
    baseUrl: `https://${CONFIG.domain}`,
    endpoints: [],
    envVars: [],
    overallStatus: 'PENDING',
  };

  // Verify endpoints
  console.log('📍 ENDPOINT CHECKS:');
  for (const endpoint of CONFIG.endpoints) {
    const url = `https://${CONFIG.domain}${endpoint}`;
    try {
      const result = await makeRequest(url);
      const isSuccess = result.status >= 200 && result.status < 400;
      console.log(`  ${isSuccess ? '✅' : '❌'} ${endpoint} - ${result.status}`);
      report.endpoints.push({
        path: endpoint,
        status: result.status,
        ok: isSuccess,
      });
    } catch (error) {
      console.log(`  ❌ ${endpoint} - ERROR: ${error.message}`);
      report.endpoints.push({
        path: endpoint,
        status: 0,
        ok: false,
        error: error.message,
      });
    }
  }

  // Check environment variables status
  console.log('\n🔑 ENVIRONMENT VARIABLES:');
  report.envVars = CONFIG.envVars.map((varName) => {
    const isDefined = process.env[varName] ? '✅' : '❌';
    console.log(`  ${isDefined} ${varName}`);
    return {
      name: varName,
      isDefined: !!process.env[varName],
    };
  });

  // Overall status
  const allEndpointsOk = report.endpoints.every((ep) => ep.ok);
  const allEnvVarsDefined = report.envVars.every((ev) => ev.isDefined);
  report.overallStatus = allEndpointsOk && allEnvVarsDefined ? 'LIVE ✅' : 'ISSUES DETECTED ⚠️';

  console.log(`\n${report.overallStatus}`);
  console.log('\n📊 DEPLOYMENT REPORT:');
  console.log(JSON.stringify(report, null, 2));

  return report;
}

verifyDeployment().catch(console.error);
