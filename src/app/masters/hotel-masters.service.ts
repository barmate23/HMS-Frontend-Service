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
  logoUrl?: string;
  logo?: string;
  bannerUrl?: string;
  gstin?: string;
  fssaiNo?: string;
  checkInTime?: string;
  checkOutTime?: string;
  starRating?: number;
  starRatingCategory?: string;
  tagline?: string;
  websiteUrl?: string;
  receptionPhone?: string;
  receptionDeskPhone?: string;
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

export interface RoomPhoto {
  id?: number;
  fileName?: string;
  fileType?: string;
  photoData: string;
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
  imageUrl?: string;
  imageUrls?: string[];
  photos?: RoomPhoto[];
  photoDataList?: string[];
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
  id?: number;
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
  logoUrl?: string;
  logo?: string;
  bannerUrl?: string;
  gstin?: string;
  fssaiNo?: string;
  checkInTime?: string;
  checkOutTime?: string;
  starRating?: number;
  starRatingCategory?: string;
  tagline?: string;
  websiteUrl?: string;
  receptionPhone?: string;
  receptionDeskPhone?: string;
}

export interface FloorRequest {
  id?: number;
  hotelId: number;
  floorNumber: string;
  noOfRooms?: number;
  telephone?: string;
}

export interface RoomTypeRequest {
  id?: number;
  hotelId: number;
  name: string;
  capacity?: number;
  basePricePerNight?: number;
  area?: number;
  description?: string;
  imageUrl?: string;
}

export interface RoomRequest {
  id?: number;
  roomNumber: string;
  floorId: number;
  roomTypeId: number;
  statusId?: number;
  hkStatusId?: number;
  status?: string;
  maxOccupancy?: number;
  telephone?: string;
  photos?: RoomPhoto[];
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

  // Room Pagination signals
  private _roomsPage = signal<number>(0);
  private _roomsTotalPages = signal<number>(1);
  private _roomsTotalElements = signal<number>(0);
  private _roomsPageSize = signal<number>(10);

  public readonly roomsPage = this._roomsPage.asReadonly();
  public readonly roomsTotalPages = this._roomsTotalPages.asReadonly();
  public readonly roomsTotalElements = this._roomsTotalElements.asReadonly();
  public readonly roomsPageSize = this._roomsPageSize.asReadonly();

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

  private extractArray<T>(data: any): T[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.content && Array.isArray(data.content)) return data.content;
    if (data.items && Array.isArray(data.items)) return data.items;
    if (typeof data === 'object') return [data as T];
    return [];
  }

  /** Load paginated rooms */
  loadRooms(page: number = 0, size: number = 10, searchText: string = '') {
    this._roomsPage.set(page);
    this._roomsPageSize.set(size);
    const searchStr = searchText ? `&searchText=${encodeURIComponent(searchText)}` : '';
    this.http.get<any>(`${this.baseUrl}/rooms/getAllRooms?page=${page}&size=${size}${searchStr}`).subscribe({
      next: (res: any) => {
        const rawData = res?.data;
        const roomsArray = this.extractArray<Room>(rawData).map((r: any) => ({
          ...r,
          typeId: r.roomTypeId,
          status: r.statusValue ? r.statusValue.toUpperCase() : 'VACANT'
        }));
        this._rooms.set(roomsArray);

        // Pagination info is inside res.metadata
        const meta = res?.metadata;
        if (meta) {
          this._roomsTotalPages.set(Math.max(1, Number(meta.totalPages) || 1));
          this._roomsTotalElements.set(Number(meta.totalRecords) || roomsArray.length);
        }
      },
      error: (err) => console.error('[HotelMastersService] loadRooms error:', err)
    });
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
      rooms: this.http.get<StandardResponse<Room[]>>(`${this.baseUrl}/rooms/getAllRooms?page=0&size=10${searchStr}`),
      ratePlans: this.http.get<StandardResponse<RatePlan[]>>(`${this.baseUrl}/ratePlans/getAllRatePlans?page=0&size=500${searchStr}`),
      gstConfigs: this.http.get<StandardResponse<GstConfig[]>>(`${this.baseUrl}/gstRules/getAllGstRules?page=0&size=500`).pipe(
        catchError(() => of({ success: true, message: '', data: [] } as StandardResponse<GstConfig[]>))
      )
    }).subscribe({
      next: (results) => {
        if (results.hotels?.success) this._hotels.set(this.extractArray<Hotel>(results.hotels.data));
        if (results.floors?.success) this._floors.set(this.extractArray<Floor>(results.floors.data));
        if (results.roomTypes?.success) this._roomTypes.set(this.extractArray<RoomType>(results.roomTypes.data));
        if (results.ratePlans?.success) this._ratePlans.set(this.extractArray<RatePlan>(results.ratePlans.data));
        if (results.gstConfigs?.success) {
          const configs = this.extractArray<GstConfig>(results.gstConfigs.data).map(g => ({
            ...g,
            igstRate: g.igstRate !== undefined ? g.igstRate : ((g.cgstRate || 0) + (g.sgstRate || 0))
          }));
          this._gstConfigs.set(configs);
        }
        if (results.rooms) {
          const res = results.rooms as any;
          const rawData = res.data;
          const roomsArray = this.extractArray<Room>(rawData).map((r: any) => ({ 
            ...r, 
            typeId: r.roomTypeId,
            status: r.statusValue ? r.statusValue.toUpperCase() : 'VACANT'
          }));
          this._rooms.set(roomsArray);
          this._roomsPage.set(0);

          // Pagination info is inside res.metadata
          const meta = res.metadata;
          if (meta) {
            this._roomsTotalPages.set(Math.max(1, Number(meta.totalPages) || 1));
            this._roomsTotalElements.set(Number(meta.totalRecords) || roomsArray.length);
          }
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
    const rawLogo = hotel.logo || hotel.logoUrl || '';
    const logoByteArray = rawLogo.includes(',') ? rawLogo.split(',')[1] : rawLogo;

    const starRatingNum = Number(hotel.starRating || 3);
    const starCategory = hotel.starRatingCategory || `${starRatingNum} Star`;

    const payload: HotelRequest = {
      ...(hotel.id ? { id: Number(hotel.id) } : {}),
      name: (hotel.name || '').trim(),
      email: (hotel.email || '').trim(),
      phone: (hotel.phone || '').trim(),
      address: (hotel.address || '').trim(),
      city: (hotel.city || '').trim(),
      state: (hotel.state || '').trim(),
      country: (hotel.country || 'India').trim(),
      zipCode: (hotel.zipCode || '400001').trim(),
      totalRooms: Number(hotel.totalRooms || 10),
      currency: hotel.currency || 'INR',
      logoUrl: logoByteArray,
      logo: logoByteArray,
      bannerUrl: hotel.bannerUrl || '',
      gstin: (hotel.gstin || '').trim(),
      fssaiNo: (hotel.fssaiNo || '').trim(),
      checkInTime: hotel.checkInTime || '12:00',
      checkOutTime: hotel.checkOutTime || '11:00',
      starRating: starRatingNum,
      starRatingCategory: starCategory,
      tagline: (hotel.tagline || '').trim(),
      websiteUrl: (hotel.websiteUrl || '').trim(),
      receptionPhone: (hotel.receptionPhone || hotel.receptionDeskPhone || '').trim(),
      receptionDeskPhone: (hotel.receptionDeskPhone || hotel.receptionPhone || '').trim()
    };

    const req$ = hotel.id
      ? this.http.put<StandardResponse<Hotel>>(`${this.baseUrl}/hotels/updateHotel/${hotel.id}`, payload)
      : this.http.post<StandardResponse<Hotel>>(`${this.baseUrl}/hotels/createHotel`, payload);

    return req$.pipe(
      map(res => {
        if (res && (res as any).success === false) {
          throw new Error(res.message || 'Failed to save hotel property');
        }
        return res.data || (res as any);
      }),
      tap(saved => {
        if (saved && saved.id) {
          if (hotel.id) {
            this._hotels.update(list => list.map(h => h.id === saved.id ? { ...h, ...saved } : h));
          } else {
            this._hotels.update(list => [saved, ...list]);
          }
        }
        this.loadAll();
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

  getRoomById(id: number): Observable<Room> {
    return this.http.get<StandardResponse<Room>>(`${this.baseUrl}/rooms/getRoomById/${id}`).pipe(
      map(res => {
        const item = res?.data || res || {};
        
        let imageUrls: string[] = [];
        if (item.photos && Array.isArray(item.photos) && item.photos.length > 0) {
          imageUrls = item.photos.map((p: any) => {
            const dataStr = p.photoData || p.data || (typeof p === 'string' ? p : '');
            if (!dataStr) return '';
            if (dataStr.startsWith('data:') || dataStr.startsWith('http')) return dataStr;
            const type = p.fileType || 'image/jpeg';
            return `data:${type};base64,${dataStr}`;
          }).filter(Boolean);
        } else if (item.photoDataList && Array.isArray(item.photoDataList) && item.photoDataList.length > 0) {
          imageUrls = item.photoDataList.map((dataStr: string) => {
            if (!dataStr) return '';
            if (dataStr.startsWith('data:') || dataStr.startsWith('http')) return dataStr;
            return `data:image/jpeg;base64,${dataStr}`;
          }).filter(Boolean);
        } else if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
          imageUrls = item.imageUrls.map((dataStr: string) => {
            if (!dataStr) return '';
            if (dataStr.startsWith('data:') || dataStr.startsWith('http')) return dataStr;
            return `data:image/jpeg;base64,${dataStr}`;
          }).filter(Boolean);
        } else if (item.imageUrl) {
          const dataStr = item.imageUrl;
          if (dataStr.startsWith('data:') || dataStr.startsWith('http')) {
            imageUrls = [dataStr];
          } else {
            imageUrls = [`data:image/jpeg;base64,${dataStr}`];
          }
        }

        const floorId = item.floorId ? Number(item.floorId) : undefined;
        const typeId = item.roomTypeId ? Number(item.roomTypeId) : (item.typeId ? Number(item.typeId) : undefined);

        return {
          ...item,
          id: Number(item.id || id),
          roomNumber: item.roomNumber || '',
          floorId,
          roomTypeId: typeId,
          typeId,
          status: item.status || item.statusValue || 'VACANT',
          statusId: item.statusId,
          hkStatusId: item.hkStatusId,
          maxOccupancy: Number(item.maxOccupancy || 2),
          telephone: item.telephone || '',
          imageUrl: imageUrls.length > 0 ? imageUrls[0] : '',
          imageUrls: imageUrls
        } as Room;
      }),
      catchError(err => {
        console.error('getRoomById error', err);
        return throwError(() => err);
      })
    );
  }

  saveRoom(room: Partial<Room>): Observable<Room> {
    const rawImageUrls = room.imageUrls || (room.imageUrl ? [room.imageUrl] : []);
    const cleanImageUrls = rawImageUrls.map(imgStr => imgStr.includes(',') ? imgStr.split(',')[1] : imgStr);
    const primaryCleanImage = cleanImageUrls.length > 0 ? cleanImageUrls[0] : '';

    const photos: RoomPhoto[] = rawImageUrls.map((imgStr, idx) => {
      const base64Bytes = imgStr.includes(',') ? imgStr.split(',')[1] : imgStr;
      let fileType = 'image/jpeg';
      if (imgStr.startsWith('data:image/png')) fileType = 'image/png';
      else if (imgStr.startsWith('data:image/webp')) fileType = 'image/webp';

      return {
        fileName: `room_photo_${idx + 1}.${fileType.split('/')[1] || 'jpg'}`,
        fileType: fileType,
        photoData: base64Bytes
      };
    });

    const payload: RoomRequest = {
      ...(room.id ? { id: Number(room.id) } : {}),
      roomNumber: (room.roomNumber || '').trim(),
      floorId: Number(room.floorId!),
      roomTypeId: Number(room.typeId ?? room.roomTypeId!),
      status: room.status || 'VACANT',
      statusId: room.statusId || (room.status === 'OCCUPIED' ? 2 : 1),
      hkStatusId: room.hkStatusId || 1,
      maxOccupancy: Number(room.maxOccupancy || 2),
      telephone: room.telephone || '',
      photos: photos
    };

    const req$ = room.id
      ? this.http.put<StandardResponse<Room>>(`${this.baseUrl}/rooms/updateRoom/${room.id}`, payload)
      : this.http.post<StandardResponse<Room>>(`${this.baseUrl}/rooms/createRoom`, payload);

    return req$.pipe(
      map(res => {
        const item = res?.data || res || {};
        const itemImageUrls = item.imageUrls || (item.imageUrl ? [item.imageUrl] : rawImageUrls);
        return {
          ...item,
          id: item.id ? Number(item.id) : (room.id ? Number(room.id) : Date.now()),
          floorId: item.floorId ? Number(item.floorId) : Number(room.floorId),
          roomTypeId: item.roomTypeId ? Number(item.roomTypeId) : Number(room.typeId),
          typeId: item.roomTypeId ? Number(item.roomTypeId) : Number(room.typeId ?? room.roomTypeId),
          imageUrl: item.imageUrl || primaryCleanImage,
          imageUrls: itemImageUrls
        };
      }),
      tap(saved => {
        if (saved && saved.id) {
          if (room.id) {
            this._rooms.update(list => list.map(r => Number(r.id) === Number(saved.id) ? { ...r, ...saved } : r));
          } else {
            this._rooms.update(list => [saved, ...list.filter(r => Number(r.id) !== Number(saved.id))]);
          }
        }
        this.loadAll();
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
