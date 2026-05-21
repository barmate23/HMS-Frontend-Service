import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface Hotel {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  totalRooms: number;
  currency?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Floor {
  id: number;
  hotelId: number;
  floorNumber: string;
  noOfRooms: number;
  telephone: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface RoomType {
  id: number;
  hotelId: number;
  name: string;
  capacity: number;
  basePricePerNight: number;
  area: number;
  description: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Room {
  id: number;
  roomNumber: string;
  floorId: number;
  roomTypeId: number;
  typeId: number; // alias for UI compatibility
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED' | 'CLEANING';
  maxOccupancy: number;
  telephone: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface HotelRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  totalRooms?: number;
  currency?: string;
}

export interface FloorRequest {
  hotelId: number;
  floorNumber: string;
  noOfRooms?: number;
  telephone?: string;
}

export interface RoomTypeRequest {
  hotelId: number;
  name: string;
  capacity?: number;
  basePricePerNight?: number;
  area?: number;
  description?: string;
  imageUrl?: string;
}

export interface RoomRequest {
  roomNumber: string;
  floorId: number;
  roomTypeId: number;
  status: string;
  maxOccupancy?: number;
  telephone?: string;
}

interface StandardResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class HotelMastersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://100.120.107.63:9002/api/v1';

  // ── Reactive Signals ──
  private _hotels = signal<Hotel[]>([]);
  private _floors = signal<Floor[]>([]);
  private _roomTypes = signal<RoomType[]>([]);
  private _rooms = signal<Room[]>([]);

  // Loading / error signals
  isLoading = signal(false);
  loadError = signal<string | null>(null);

  // Read-only public signals
  public readonly hotels = this._hotels.asReadonly();
  public readonly floors = this._floors.asReadonly();
  public readonly roomTypes = this._roomTypes.asReadonly();
  public readonly rooms = this._rooms.asReadonly();

  // ── Computed Maps ──
  public readonly hotelsMap = computed(() => new Map(this.hotels().map(h => [h.id, h])));
  public readonly floorsMap = computed(() => new Map(this.floors().map(f => [f.id, f])));
  public readonly roomTypesMap = computed(() => new Map(this.roomTypes().map(rt => [rt.id, rt])));

  constructor() {
    this.loadAll();
  }

  /** Load all entities concurrently from the backend */
  loadAll() {
    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      hotels: this.http.get<StandardResponse<Hotel[]>>(`${this.baseUrl}/hotels/getAllHotels`),
      floors: this.http.get<StandardResponse<Floor[]>>(`${this.baseUrl}/floors/getAllFloors`),
      roomTypes: this.http.get<StandardResponse<RoomType[]>>(`${this.baseUrl}/roomTypes/getAllRoomTypes`),
      rooms: this.http.get<StandardResponse<Room[]>>(`${this.baseUrl}/rooms/getAllRooms`)
    }).subscribe({
      next: (results) => {
        if (results.hotels.success) this._hotels.set(results.hotels.data ?? []);
        if (results.floors.success) this._floors.set(results.floors.data ?? []);
        if (results.roomTypes.success) this._roomTypes.set(results.roomTypes.data ?? []);
        if (results.rooms.success) {
          // Normalise: backend uses roomTypeId, UI also needs typeId alias
          const rooms = (results.rooms.data ?? []).map(r => ({ ...r, typeId: r.roomTypeId }));
          this._rooms.set(rooms);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.loadError.set('Failed to load data from the server. Please check your connection.');
        this.isLoading.set(false);
        console.error('[HotelMastersService] loadAll error:', err);
      }
    });
  }

  // ─── Hotels CRUD ─────────────────────────────────────────────────────────────

  saveHotel(hotel: Partial<Hotel>): Observable<Hotel> {
    const payload: HotelRequest = {
      name: hotel.name!,
      email: hotel.email!,
      phone: hotel.phone,
      address: hotel.address,
      city: hotel.city,
      state: hotel.state,
      country: hotel.country,
      zipCode: hotel.zipCode,
      totalRooms: hotel.totalRooms,
      currency: hotel.currency
    };

    const req$ = hotel.id
      ? this.http.put<StandardResponse<Hotel>>(`${this.baseUrl}/hotels/updateHotel/${hotel.id}`, payload)
      : this.http.post<StandardResponse<Hotel>>(`${this.baseUrl}/hotels/createHotel`, payload);

    return req$.pipe(
      map(res => res.data),
      tap(saved => {
        if (hotel.id) {
          this._hotels.update(list => list.map(h => h.id === saved.id ? { ...h, ...saved } : h));
        } else {
          this._hotels.update(list => [saved, ...list]);
        }
      }),
      catchError(err => { console.error('saveHotel error', err); return throwError(() => err); })
    );
  }

  deleteHotel(id: number): Observable<void> {
    return this.http.delete<StandardResponse<void>>(`${this.baseUrl}/hotels/deleteHotel/${id}`).pipe(
      tap(() => this._hotels.update(list => list.filter(h => h.id !== id))),
      map(() => void 0),
      catchError(err => { console.error('deleteHotel error', err); return throwError(() => err); })
    );
  }

  // ─── Floors CRUD ─────────────────────────────────────────────────────────────

  saveFloor(floor: Partial<Floor>): Observable<Floor> {
    const payload: FloorRequest = {
      hotelId: floor.hotelId!,
      floorNumber: floor.floorNumber!,
      noOfRooms: floor.noOfRooms,
      telephone: floor.telephone
    };

    const req$ = floor.id
      ? this.http.put<StandardResponse<Floor>>(`${this.baseUrl}/floors/updateFloor/${floor.id}`, payload)
      : this.http.post<StandardResponse<Floor>>(`${this.baseUrl}/floors/createFloor`, payload);

    return req$.pipe(
      map(res => res.data),
      tap(saved => {
        if (floor.id) {
          this._floors.update(list => list.map(f => f.id === saved.id ? { ...f, ...saved } : f));
        } else {
          this._floors.update(list => [saved, ...list]);
        }
      }),
      catchError(err => { console.error('saveFloor error', err); return throwError(() => err); })
    );
  }

  deleteFloor(id: number): Observable<void> {
    return this.http.delete<StandardResponse<void>>(`${this.baseUrl}/floors/deleteFloor/${id}`).pipe(
      tap(() => this._floors.update(list => list.filter(f => f.id !== id))),
      map(() => void 0),
      catchError(err => { console.error('deleteFloor error', err); return throwError(() => err); })
    );
  }

  // ─── Room Types CRUD ─────────────────────────────────────────────────────────

  saveRoomType(roomType: Partial<RoomType>): Observable<RoomType> {
    const payload: RoomTypeRequest = {
      hotelId: roomType.hotelId!,
      name: roomType.name!,
      capacity: roomType.capacity,
      basePricePerNight: roomType.basePricePerNight,
      area: roomType.area,
      description: roomType.description,
      imageUrl: roomType.imageUrl
    };

    const req$ = roomType.id
      ? this.http.put<StandardResponse<RoomType>>(`${this.baseUrl}/roomTypes/updateRoomType/${roomType.id}`, payload)
      : this.http.post<StandardResponse<RoomType>>(`${this.baseUrl}/roomTypes/createRoomType`, payload);

    return req$.pipe(
      map(res => res.data),
      tap(saved => {
        if (roomType.id) {
          this._roomTypes.update(list => list.map(rt => rt.id === saved.id ? { ...rt, ...saved } : rt));
        } else {
          this._roomTypes.update(list => [saved, ...list]);
        }
      }),
      catchError(err => { console.error('saveRoomType error', err); return throwError(() => err); })
    );
  }

  deleteRoomType(id: number): Observable<void> {
    return this.http.delete<StandardResponse<void>>(`${this.baseUrl}/roomTypes/deleteRoomType/${id}`).pipe(
      tap(() => this._roomTypes.update(list => list.filter(rt => rt.id !== id))),
      map(() => void 0),
      catchError(err => { console.error('deleteRoomType error', err); return throwError(() => err); })
    );
  }

  // ─── Rooms CRUD ──────────────────────────────────────────────────────────────

  saveRoom(room: Partial<Room>): Observable<Room> {
    const payload: RoomRequest = {
      roomNumber: room.roomNumber!,
      floorId: room.floorId!,
      roomTypeId: room.typeId ?? room.roomTypeId!,
      status: room.status!,
      maxOccupancy: room.maxOccupancy,
      telephone: room.telephone
    };

    const req$ = room.id
      ? this.http.put<StandardResponse<Room>>(`${this.baseUrl}/rooms/updateRoom/${room.id}`, payload)
      : this.http.post<StandardResponse<Room>>(`${this.baseUrl}/rooms/createRoom`, payload);

    return req$.pipe(
      map(res => ({ ...res.data, typeId: res.data.roomTypeId })),
      tap(saved => {
        if (room.id) {
          this._rooms.update(list => list.map(r => r.id === saved.id ? { ...r, ...saved } : r));
        } else {
          this._rooms.update(list => [saved, ...list]);
        }
      }),
      catchError(err => { console.error('saveRoom error', err); return throwError(() => err); })
    );
  }

  deleteRoom(id: number): Observable<void> {
    return this.http.delete<StandardResponse<void>>(`${this.baseUrl}/rooms/deleteRoom/${id}`).pipe(
      tap(() => this._rooms.update(list => list.filter(r => r.id !== id))),
      map(() => void 0),
      catchError(err => { console.error('deleteRoom error', err); return throwError(() => err); })
    );
  }
}
