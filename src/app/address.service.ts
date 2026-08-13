import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface Country {
  id: number;
  name: string;
  code?: string;
  phoneCode?: string;
}

export interface State {
  id: number;
  name: string;
  code?: string;
  countryId?: number;
}

export interface City {
  id: number;
  name: string;
  stateId?: number;
}

export interface StandardResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/frontOfficeService/v1/address';

  countries = signal<Country[]>([]);
  states = signal<State[]>([]);
  cities = signal<City[]>([]);

  isLoading = signal(false);

  loadCountries(): Observable<Country[]> {
    this.isLoading.set(true);
    return this.http.get<StandardResponse<Country[]> | Country[]>(`${this.baseUrl}/countries`).pipe(
      map(res => {
        const raw = (res as any)?.data !== undefined ? (res as any).data : res;
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') return [raw];
        return [];
      }),
      tap(list => {
        this.countries.set(list);
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.error('[AddressService] loadCountries error:', err);
        this.isLoading.set(false);
        return of([]);
      })
    );
  }

  loadStates(countryId?: number): Observable<State[]> {
    const url = countryId ? `${this.baseUrl}/states?countryId=${countryId}` : `${this.baseUrl}/states`;
    this.isLoading.set(true);
    return this.http.get<StandardResponse<State[]> | State[]>(url).pipe(
      map(res => {
        const raw = (res as any)?.data !== undefined ? (res as any).data : res;
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') return [raw];
        return [];
      }),
      tap(list => {
        this.states.set(list);
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.error('[AddressService] loadStates error:', err);
        this.isLoading.set(false);
        return of([]);
      })
    );
  }

  loadCities(stateId?: number): Observable<City[]> {
    const url = stateId ? `${this.baseUrl}/cities?stateId=${stateId}` : `${this.baseUrl}/cities`;
    this.isLoading.set(true);
    return this.http.get<StandardResponse<City[]> | City[]>(url).pipe(
      map(res => {
        const raw = (res as any)?.data !== undefined ? (res as any).data : res;
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') return [raw];
        return [];
      }),
      tap(list => {
        this.cities.set(list);
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.error('[AddressService] loadCities error:', err);
        this.isLoading.set(false);
        return of([]);
      })
    );
  }
}
