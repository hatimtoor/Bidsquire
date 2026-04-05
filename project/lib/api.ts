const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Server-side only — never exposed to the browser
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

export interface ApiResponse<T = any> {
  message: string;
  status: string;
  data?: T;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (INTERNAL_API_SECRET) {
      headers['X-Internal-Secret'] = INTERNAL_API_SECRET;
    }
    return headers;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API GET request failed:', error);
      throw error;
    }
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API POST request failed:', error);
      throw error;
    }
  }
}

// Create a default API client instance
export const apiClient = new ApiClient();

// API endpoints
export const API_ENDPOINTS = {
  HELLO: '/hello/',
  TEST_POST: '/test-post/',
  TEST_WEBHOOK_DATA: '/test-webhook-data/',
  CALL_WEBHOOK: '/call-webhook/',
  SUBMIT_PHOTOGRAPHY: '/submit-photography/',
  RECEIVE_WEBHOOK_DATA: '/receive-webhook-data/',
  GET_WEBHOOK_DATA: '/get-webhook-data/',
} as const; 