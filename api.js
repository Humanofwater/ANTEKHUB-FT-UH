// ============================
// API client for ANTEKHUB FT-UH
// ============================

// Base URL for the server
const BASE_URL = 'http://localhost:3000/api';

// Helper function to get token from localStorage
function getToken() {
  return localStorage.getItem('authToken');
}

// Helper function to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getToken();

  if (!token && !endpoint.includes('/login')) {
    console.error('No auth token found');
    throw new Error('Silakan login terlebih dahulu');
  }

  const defaultOptions = {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
    },
  };

  try {
    console.log(`🚀 Sending ${options.method || 'GET'} request to: ${endpoint}`);
    if (options.body) {
      console.log('Request payload:',
        options.body instanceof FormData
          ? Object.fromEntries(options.body.entries())
          : options.body
      );
    }

    const response = await fetch(url, { ...defaultOptions, ...options });

    console.log(`📥 Response from ${endpoint}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Tangani 422 secara khusus
      const message = data?.message || data || `Error ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    return data;
  } catch (error) {
    console.error(`❌ API request failed: ${endpoint}`, error);
    throw error; // Propagate error
  }
}

// ============================
// Define window.API
// ============================
window.API = {
  baseURL: BASE_URL,

  // === AUTH MODULE ===
  auth: {
    logout: () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
    },
  },

  // === ALUMNI MODULE ===
  alumni: {
    getAllAlumni: () => apiRequest('/alumni'),
    getOneAlumni: (uuid) => apiRequest(`/alumni/${uuid}`),
    createAlumni: (data) =>
      apiRequest('/alumni', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateAlumni: (uuid, data) =>
      apiRequest(`/alumni/${uuid}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteAlumni: (uuid) =>
      apiRequest(`/alumni/${uuid}`, {
        method: 'DELETE',
      }),
  },

  // === BANGSA MODULE ===
  bangsa: {
    getAll: () => apiRequest('/negara'),
  },

  // === SUKU MODULE ===
  suku: {
    getAll: () => apiRequest('/suku'),
  },

  // === PROGRAM STUDI MODULE ===
  programStudi: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest('/program-studi' + (query ? '?' + query : ''));
    },
  },

  // === USER ADMIN MODULE ===
  userAdmin: {
    getAllAdmins: () => apiRequest('/user-admin'),
    getOneAdmin: (uuid) => apiRequest(`/user-admin/${uuid}`),
    createAdmin: (data) =>
      apiRequest('/user-admin', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateAdmin: (uuid, data) =>
      apiRequest(`/user-admin/${uuid}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteAdmin: (uuid) =>
      apiRequest(`/user-admin/${uuid}`, {
        method: 'DELETE',
      }),
  },

  // === INFO MODULE ===
  info: {
    getAllInfo: () => apiRequest('/info'),
    getOneInfo: (id) => apiRequest(`/info/${id}`),
    createInfo: async (data) => {
      const formData = data instanceof FormData ? data : new FormData();
      if (!(data instanceof FormData)) {
        Object.keys(data).forEach((key) => {
          if (key === 'image' && data[key]) {
            formData.append('image', data[key]);
          } else {
            formData.append(key, data[key]);
          }
        });
      }

      const response = await fetch(BASE_URL + '/info', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Gagal membuat info (${response.status})`);
      }
      return await response.json();
    },
    updateInfo: async (id, data) => {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        if (key === 'image' && data[key]) {
          formData.append('image', data[key]);
        } else {
          formData.append(key, data[key]);
        }
      });

      const response = await fetch(`${BASE_URL}/info/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Gagal update info (${response.status})`);
      }
      return await response.json();
    },
    deleteInfo: (id) =>
      apiRequest(`/info/${id}`, {
        method: 'DELETE',
      }),
  },
};
