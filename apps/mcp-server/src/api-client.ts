import dotenv from 'dotenv';
dotenv.config();

export interface ApiErrorResponse {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorResponse;
}

export class VelurixApiClientError extends Error {
  public code?: string;
  public httpStatus: number;

  constructor(message: string, httpStatus: number, code?: string) {
    super(message);
    this.name = 'VelurixApiClientError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

/**
 * Robust HTTP client for the Velurix ReachOut API
 */
export class VelurixApiClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultTimeout = 10000;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.VELURIX_API_URL || 'http://localhost:8080/api/v1';
    this.apiKey = apiKey || process.env.VELURIX_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('VelurixApiClient: VELURIX_API_KEY is not set. Requests may fail.');
    }
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
      const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      };

      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const rawText = await response.text();
      let responseData: ApiEnvelope<T> | null = null;

      if (rawText) {
        try {
          responseData = JSON.parse(rawText) as ApiEnvelope<T>;
        } catch (e) {
          // Response is non-JSON
        }
      }

      if (!response.ok || !responseData || responseData.success === false) {
        const errorMsg = responseData?.error?.message || (rawText && rawText.length < 500 ? rawText : response.statusText) || 'Unknown HTTP error';
        const errorCode = responseData?.error?.code || `HTTP_${response.status}`;
        throw new VelurixApiClientError(errorMsg, response.status, errorCode);
      }

      return (responseData.data !== undefined ? responseData.data : responseData) as T;
    } catch (error) {
      if (error instanceof VelurixApiClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new VelurixApiClientError('Request timed out', 408, 'TIMEOUT');
      }
      const msg = error instanceof Error ? error.message : String(error);
      throw new VelurixApiClientError(`Network error: ${msg}`, 500, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  public async post<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  public async put<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  public async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export const api = new VelurixApiClient();
