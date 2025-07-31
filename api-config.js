// Configuración de APIs para conectar el dashboard con n8n
const API_BASE_URL = 'http://localhost:5678/webhook'; // URL base de n8n

export const API_ENDPOINTS = {
  positions: `${API_BASE_URL}/api/positions`,
  portfolio: `${API_BASE_URL}/api/portfolio`, 
  alerts: `${API_BASE_URL}/api/alerts`
};

// Función para obtener posiciones
export const fetchPositions = async () => {
  const response = await fetch(API_ENDPOINTS.positions);
  return response.json();
};

// Función para obtener datos del portfolio
export const fetchPortfolio = async () => {
  const response = await fetch(API_ENDPOINTS.portfolio);
  return response.json();
};

// Función para obtener alertas
export const fetchAlerts = async () => {
  const response = await fetch(API_ENDPOINTS.alerts);
  return response.json();
};
