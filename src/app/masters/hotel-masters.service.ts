import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, throwError, of } from 'rxjs';
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
  statusId?: number;
  statusValue?: string;
  hkStatusId?: number;
  hkStatusValue?: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED' | 'CLEANING' | string;
  maxOccupancy: number;
  telephone: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface RatePlan {
  id: number;
  name: string;
  description: string;
  priceAdjustment: number;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface GstConfig {
  id: number;
  serviceCategory: string;
  hsnSacCode: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface RatePlanRequest {
  name: string;
  description?: string;
  priceAdjustment?: number;
  displayOrder?: number;
}

interface StandardResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

// ─── Service ───────────────────────────────────────────────────────────────────

const defaultGstConfigs: GstConfig[] = [
  { id: 1, serviceCategory: 'Room', hsnSacCode: '9963', cgstRate: 6, sgstRate: 6, igstRate: 12, description: 'GST rate for Room accommodation Services.', isActive: true },
  { id: 2, serviceCategory: 'Food', hsnSacCode: '9963', cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, description: 'GST rate for Restaurant and Food service supply.', isActive: true },
  { id: 3, serviceCategory: 'Beverages', hsnSacCode: '2202', cgstRate: 9, sgstRate: 9, igstRate: 18, description: 'GST rate for Aerated / carbonated and other beverages.', isActive: true },
  { id: 4, serviceCategory: 'Laundry', hsnSacCode: '9987', cgstRate: 9, sgstRate: 9, igstRate: 18, description: 'GST rate for laundry, dry cleaning, and cleaning services.', isActive: true },
  { id: 5, serviceCategory: 'Spa', hsnSacCode: '9997', cgstRate: 9, sgstRate: 9, igstRate: 18, description: 'GST rate for beauty parlour and spa treatments.', isActive: true },
  { id: 6, serviceCategory: 'Gym', hsnSacCode: '9997', cgstRate: 9, sgstRate: 9, igstRate: 18, description: 'GST rate for gym membership and fitness services.', isActive: true },
  { id: 7, serviceCategory: 'Other Service', hsnSacCode: '9999', cgstRate: 9, sgstRate: 9, igstRate: 18, description: 'Standard rate for other miscellaneous service charges.', isActive: true }
];

@Injectable({ providedIn: 'root' })
export class HotelMastersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/masterService/v1';

  // ── Reactive Signals ──
  private _hotels = signal<Hotel[]>([]);
  private _floors = signal<Floor[]>([]);
  private _roomTypes = signal<RoomType[]>([]);
  private _rooms = signal<Room[]>([]);
  private _ratePlans = signal<RatePlan[]>([]);
  private _gstConfigs = signal<GstConfig[]>([]);

  // Loading / error signals
  isLoading = signal(false);
  loadError = signal<string | null>(null);

  // Read-only public signals
  public readonly hotels = this._hotels.asReadonly();
  public readonly floors = this._floors.asReadonly();
  public readonly roomTypes = this._roomTypes.asReadonly();
  public readonly rooms = this._rooms.asReadonly();
  public readonly ratePlans = this._ratePlans.asReadonly();
  public readonly gstConfigs = this._gstConfigs.asReadonly();

  // ── Computed Maps ──
  public readonly hotelsMap = computed(() => new Map(this.hotels().map(h => [h.id, h])));
  public readonly floorsMap = computed(() => new Map(this.floors().map(f => [f.id, f])));
  public readonly roomTypesMap = computed(() => new Map(this.roomTypes().map(rt => [rt.id, rt])));

  constructor() {
    this.loadAll();
  }

  /** Load all entities concurrently from the backend */
  loadAll(searchText: string = '') {
    this.isLoading.set(true);
    this.loadError.set(null);

    const searchStr = searchText ? `&searchText=${encodeURIComponent(searchText)}` : '';

    forkJoin({
      hotels: this.http.get<StandardResponse<Hotel[]>>(`${this.baseUrl}/hotels/getAllHotels?page=0&size=500${searchStr}`),
      floors: this.http.get<StandardResponse<Floor[]>>(`${this.baseUrl}/floors/getAllFloors?page=0&size=500${searchStr}`),
      roomTypes: this.http.get<StandardResponse<RoomType[]>>(`${this.baseUrl}/roomTypes/getAllRoomTypes?page=0&size=500${searchStr}`),
      rooms: this.http.get<StandardResponse<Room[]>>(`${this.baseUrl}/rooms/getAllRooms?page=0&size=500${searchStr}`),
      ratePlans: this.http.get<StandardResponse<RatePlan[]>>(`${this.baseUrl}/ratePlans/getAllRatePlans?page=0&size=500${searchStr}`),
      gstConfigs: this.http.get<StandardResponse<GstConfig[]>>(`${this.baseUrl}/gstRules/getAllGstRules?page=0&size=500`).pipe(
        catchError(() => {
          const local = localStorage.getItem('hms-gst-config');
          const data = local ? JSON.parse(local) : defaultGstConfigs;
          localStorage.setItem('hms-gst-config', JSON.stringify(data));
          return of({ success: true, message: 'Local storage fallback', data } as StandardResponse<GstConfig[]>);
        })
      )
    }).subscribe({
      next: (results) => {
        if (results.hotels.success) this._hotels.set(results.hotels.data ?? []);
        if (results.floors.success) this._floors.set(results.floors.data ?? []);
        if (results.roomTypes.success) this._roomTypes.set(results.roomTypes.data ?? []);
        if (results.ratePlans.success) this._ratePlans.set(results.ratePlans.data ?? []);
        if (results.gstConfigs.success) {
          const configs = (results.gstConfigs.data ?? []).map(g => ({
            ...g,
            igstRate: g.igstRate !== undefined ? g.igstRate : ((g.cgstRate || 0) + (g.sgstRate || 0))
          }));
          this._gstConfigs.set(configs);
        }
        if (results.rooms.success) {
          // Normalise: backend uses roomTypeId, UI also needs typeId alias, map status correctly to stop UI break
          const rooms = (results.rooms.data ?? []).map((r: any) => ({ 
            ...r, 
            typeId: r.roomTypeId,
            status: r.statusValue ? r.statusValue.toUpperCase() : 'VACANT'
          }));
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

  saveRatePlan(ratePlan: Partial<RatePlan>): Observable<RatePlan> {
    const payload: RatePlanRequest = {
      name: ratePlan.name!,
      description: ratePlan.description,
      priceAdjustment: ratePlan.priceAdjustment,
      displayOrder: ratePlan.displayOrder
    };

    const req$ = ratePlan.id
      ? this.http.put<StandardResponse<RatePlan>>(`${this.baseUrl}/ratePlans/updateRatePlan/${ratePlan.id}`, payload)
      : this.http.post<StandardResponse<RatePlan>>(`${this.baseUrl}/ratePlans/createRatePlan`, payload);

    return req$.pipe(
      map(res => res.data),
      tap(saved => {
        if (ratePlan.id) {
          this._ratePlans.update(list => list.map(rp => rp.id === saved.id ? { ...rp, ...saved } : rp));
        } else {
          this._ratePlans.update(list => [saved, ...list]);
        }
      }),
      catchError(err => { console.error('saveRatePlan error', err); return throwError(() => err); })
    );
  }

  deleteRatePlan(id: number): Observable<void> {
    return this.http.delete<StandardResponse<void>>(`${this.baseUrl}/ratePlans/deleteRatePlan/${id}`).pipe(
      tap(() => this._ratePlans.update(list => list.filter(rp => rp.id !== id))),
      map(() => void 0),
      catchError(err => { console.error('deleteRatePlan error', err); return throwError(() => err); })
    );
  }

  saveGst(gst: Partial<GstConfig>): Observable<GstConfig> {
    const payload = {
      serviceCategory: gst.serviceCategory!,
      hsnSacCode: gst.hsnSacCode!,
      cgstRate: gst.cgstRate!,
      sgstRate: gst.sgstRate!,
      igstRate: gst.igstRate!,
      description: gst.description,
      isActive: gst.isActive
    };

    const endpoint = gst.id
      ? `${this.baseUrl}/gstRules/updateGstRule/${gst.id}`
      : `${this.baseUrl}/gstRules/createGstRule`;

    const req$ = gst.id
      ? this.http.put<StandardResponse<GstConfig>>(endpoint, payload)
      : this.http.post<StandardResponse<GstConfig>>(endpoint, payload);

    return req$.pipe(
      map(res => res.data),
      tap(saved => {
        if (gst.id) {
          this._gstConfigs.update(list => list.map(g => g.id === saved.id ? { ...g, ...saved } : g));
        } else {
          this._gstConfigs.update(list => [saved, ...list]);
        }
        localStorage.setItem('hms-gst-config', JSON.stringify(this._gstConfigs()));
      }),
      catchError(err => {
        console.warn('Backend saveGst failed, performing local storage save fallback:', err);
        let saved: GstConfig;
        if (gst.id) {
          saved = { ...gst } as GstConfig;
          this._gstConfigs.update(list => list.map(g => g.id === gst.id ? { ...g, ...saved } : g));
        } else {
          const newId = this._gstConfigs().reduce((max, item) => item.id > max ? item.id : max, 0) + 1;
          saved = { ...gst, id: newId } as GstConfig;
          this._gstConfigs.update(list => [saved, ...list]);
        }
        localStorage.setItem('hms-gst-config', JSON.stringify(this._gstConfigs()));
        return of(saved);
      })
    );
  }

  deleteGst(id: number): Observable<void> {
    return this.http.delete<StandardResponse<void>>(`${this.baseUrl}/gstRules/deleteGstRule/${id}`).pipe(
      tap(() => {
        this._gstConfigs.update(list => list.filter(g => g.id !== id));
        localStorage.setItem('hms-gst-config', JSON.stringify(this._gstConfigs()));
      }),
      map(() => void 0),
      catchError(err => {
        console.warn('Backend deleteGst failed, performing local storage delete fallback:', err);
        this._gstConfigs.update(list => list.filter(g => g.id !== id));
        localStorage.setItem('hms-gst-config', JSON.stringify(this._gstConfigs()));
        return of(void 0);
      })
    );
  }
}
