/**
 * Vecta Compliance Verification — API Service Layer
 * Target Backend: FastAPI api_server.py (http://localhost:8000)
 * 
 * Strict Rule: Only backend-defined endpoints and request/response structures.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * POST /analyze
 * Ingests a master tender PDF and one or more bidder PDFs.
 * 
 * @param {File} tenderFile - Single PDF file of the tender document (ATC / NIT)
 * @param {Array<{file: File, derivedName?: string}>} bidderItems - Array of bidder file objects
 * @returns {Promise<Array<Object>>} - Array of BidReport objects, one per bidder
 */
export async function analyzeTenderAndBidders(tenderFile, bidderItems) {
  if (!tenderFile) {
    throw new Error('Tender PDF document is required.');
  }
  if (!bidderItems || bidderItems.length === 0) {
    throw new Error('At least one bidder PDF document is required.');
  }

  const formData = new FormData();
  formData.append('tender', tenderFile);

  const derivedNames = [];
  bidderItems.forEach(item => {
    formData.append('bidders', item.file);
    derivedNames.push(item.derivedName || item.file.name.replace(/\.pdf$/i, ''));
  });

  formData.append('bidder_names', JSON.stringify(derivedNames));

  let response;
  try {
    response = await fetch(`${BASE_URL}/analyze`, {
      method: 'POST',
      body: formData,
    });
  } catch (networkError) {
    throw new Error(
      `Backend unavailable at ${BASE_URL}. Ensure the Python API server is running (python api_server.py). Error: ${networkError.message}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Analysis request failed with HTTP status ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) {
        errorMessage = typeof errorJson.detail === 'string' 
          ? errorJson.detail 
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      if (errorText) errorMessage += `: ${errorText.substring(0, 150)}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data;
}
