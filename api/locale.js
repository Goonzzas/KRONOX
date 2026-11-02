const SPANISH_COUNTRIES = new Set([
  'AR',
  'BO',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'ES',
  'GQ',
  'GT',
  'HN',
  'MX',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SV',
  'UY',
  'VE',
]);

export default function handler(request, response) {
  const country = request.headers['x-vercel-ip-country'] || '';
  response.setHeader('Cache-Control', 'private, no-store');
  return response.status(200).json({
    language: country ? (SPANISH_COUNTRIES.has(country.toUpperCase()) ? 'es' : 'en') : null,
  });
}
