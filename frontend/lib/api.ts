const API_BASE_URL = "http://localhost:8000";

// Custom error class for API errors
class APIError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = "APIError";
  }
}

// Enhanced fetch wrapper with better error handling
async function fetchWithErrorHandling(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch {
        // If response is not JSON, use status text
      }

      throw new APIError(response.status, errorMessage, errorDetails);
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network or other errors
    throw new APIError(0, `Network error: ${error.message}`, error);
  }
}

export const api = {
  // User Management
  async getUsers() {
    return fetchWithErrorHandling(`${API_BASE_URL}/users`);
  },

  async createUser(userData: { name: string; email: string }) {
    return fetchWithErrorHandling(`${API_BASE_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
  },

  // Group Management
  async getGroups() {
    return fetchWithErrorHandling(`${API_BASE_URL}/groups`);
  },

  async getGroupDetail(groupId: number) {
    return fetchWithErrorHandling(`${API_BASE_URL}/groups/${groupId}`);
  },

  async createGroup(groupData: { name: string; user_ids: number[] }) {
    return fetchWithErrorHandling(`${API_BASE_URL}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groupData),
    });
  },

  // Expense Management
  async getGroupExpenses(groupId: number) {
    return fetchWithErrorHandling(`${API_BASE_URL}/groups/${groupId}/expenses`);
  },

  async addExpense(
    groupId: number,
    expenseData: {
      description: string;
      amount: number;
      paid_by: number;
      split_type: "equal" | "percentage";
      splits: { user_id: number; percentage?: number }[];
    }
  ) {
    return fetchWithErrorHandling(`${API_BASE_URL}/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expenseData),
    });
  },

  // Balance Calculations
  async getGroupBalances(groupId: number) {
    return fetchWithErrorHandling(`${API_BASE_URL}/groups/${groupId}/balances`);
  },

  async getUserBalances(userId: number) {
    return fetchWithErrorHandling(`${API_BASE_URL}/users/${userId}/balances`);
  },

  // Health check endpoint
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/docs`);
      return response.ok;
    } catch {
      return false;
    }
  },
};

// Export the APIError class for use in components
export { APIError };
