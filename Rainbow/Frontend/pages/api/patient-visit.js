export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mrn } = req.body;

  if (!mrn || !mrn.trim()) {
    return res.status(400).json({ error: 'MRN is required' });
  }

  const apiUrl = process.env.PATIENT_VISIT_API_URL || 'http://10.10.225.15:5005/thirdparty/GetPatientVisit/';
  console.log(`[patient-visit] Fetching MRN: ${mrn} from: ${apiUrl}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mrn: mrn.trim() }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();
    console.log(`[patient-visit] Response status: ${response.status}, data:`, JSON.stringify(data).substring(0, 200));

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch patient data', details: data });
    }

    // Client API returns an array — extract first item
    const patientData = Array.isArray(data) ? data[0] : data;

    if (!patientData) {
      return res.status(404).json({ error: 'No patient found for this MRN' });
    }

    return res.status(200).json(patientData);
  } catch (error) {
    console.error('[patient-visit] Error:', error.message);
    return res.status(503).json({ error: 'Cannot reach patient data service', details: error.message });
  }
}
