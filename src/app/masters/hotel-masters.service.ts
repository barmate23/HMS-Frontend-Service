import { Injectable, signal, computed } from '@angular/core';

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
  currency: string;
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
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Room {
  id: number;
  roomNumber: string;
  floorId: number;
  typeId: number;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED' | 'CLEANING';
  maxOccupancy: number;
  telephone: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class HotelMastersService {
  // Writable signals holding the entity lists
  private _hotels = signal<Hotel[]>([
    {
      id: 1,
      name: 'Oasis Palms Resort',
      email: 'hello@oasispalms.com',
      phone: '+1 305-555-0199',
      address: '4200 Collins Ave',
      city: 'Miami Beach',
      state: 'Florida',
      country: 'USA',
      zipCode: '33140',
      totalRooms: 150,
      currency: 'USD',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-05-18T14:30:00Z',
      isActive: true
    },
    {
      id: 2,
      name: 'The Terracotta Palace',
      email: 'reservations@terracottapalace.com',
      phone: '+39 06 555 7890',
      address: 'Viale della Trinità dei Monti, 17',
      city: 'Rome',
      state: 'Lazio',
      country: 'Italy',
      zipCode: '00187',
      totalRooms: 85,
      currency: 'EUR',
      createdAt: '2026-02-15T09:15:00Z',
      updatedAt: '2026-05-15T11:00:00Z',
      isActive: true
    }
  ]);

  private _floors = signal<Floor[]>([
    {
      id: 1,
      hotelId: 1,
      floorNumber: 'Floor 1',
      noOfRooms: 30,
      telephone: '+1 305-555-1001',
      createdAt: '2026-01-10T10:05:00Z',
      updatedAt: '2026-01-10T10:05:00Z',
      isActive: true
    },
    {
      id: 2,
      hotelId: 1,
      floorNumber: 'Floor 2',
      noOfRooms: 30,
      telephone: '+1 305-555-1002',
      createdAt: '2026-01-10T10:06:00Z',
      updatedAt: '2026-01-10T10:06:00Z',
      isActive: true
    },
    {
      id: 3,
      hotelId: 1,
      floorNumber: 'Floor 3',
      noOfRooms: 40,
      telephone: '+1 305-555-1003',
      createdAt: '2026-01-10T10:07:00Z',
      updatedAt: '2026-01-10T10:07:00Z',
      isActive: true
    },
    {
      id: 4,
      hotelId: 2,
      floorNumber: 'Ground Floor',
      noOfRooms: 45,
      telephone: '+39 06 555 1010',
      createdAt: '2026-02-15T09:20:00Z',
      updatedAt: '2026-02-15T09:20:00Z',
      isActive: true
    }
  ]);

  private _roomTypes = signal<RoomType[]>([
    {
      id: 1,
      hotelId: 1,
      name: 'Single Room',
      capacity: 1,
      basePricePerNight: 120.00,
      area: 250.0,
      description: 'Cozy and functional room for a single traveller. Equipped with an ergonomic desk and scenic garden view.',
      createdAt: '2026-01-10T10:10:00Z',
      updatedAt: '2026-05-10T08:00:00Z',
      isActive: true
    },
    {
      id: 2,
      hotelId: 1,
      name: 'Double Room',
      capacity: 2,
      basePricePerNight: 180.00,
      area: 380.0,
      description: 'Elegant room featuring a king-size bed, private balcony, and state-of-the-art layout.',
      createdAt: '2026-01-10T10:11:00Z',
      updatedAt: '2026-05-12T09:00:00Z',
      isActive: true
    },
    {
      id: 3,
      hotelId: 1,
      name: 'Luxury Suite',
      capacity: 4,
      basePricePerNight: 350.00,
      area: 650.0,
      description: 'Spacious signature suite with panoramic ocean views, private living room, dining area, and deluxe bath.',
      createdAt: '2026-01-10T10:12:00Z',
      updatedAt: '2026-05-14T10:00:00Z',
      isActive: true
    },
    {
      id: 4,
      hotelId: 2,
      name: 'Palazzo Deluxe',
      capacity: 2,
      basePricePerNight: 280.00,
      area: 450.0,
      description: 'Bespoke Roman style luxury room with original fresco detailing, high ceilings, and walk-in wardrobe.',
      createdAt: '2026-02-15T09:25:00Z',
      updatedAt: '2026-02-15T09:25:00Z',
      isActive: true
    }
  ]);

  private _rooms = signal<Room[]>([
    {
      id: 1,
      roomNumber: '101',
      floorId: 1,
      typeId: 1,
      status: 'VACANT',
      maxOccupancy: 1,
      telephone: '1101',
      createdAt: '2026-01-10T10:20:00Z',
      updatedAt: '2026-05-18T10:00:00Z',
      isActive: true
    },
    {
      id: 2,
      roomNumber: '102',
      floorId: 1,
      typeId: 2,
      status: 'OCCUPIED',
      maxOccupancy: 2,
      telephone: '1102',
      createdAt: '2026-01-10T10:21:00Z',
      updatedAt: '2026-05-19T12:00:00Z',
      isActive: true
    },
    {
      id: 3,
      roomNumber: '103',
      floorId: 1,
      typeId: 3,
      status: 'MAINTENANCE',
      maxOccupancy: 4,
      telephone: '1103',
      createdAt: '2026-01-10T10:22:00Z',
      updatedAt: '2026-05-19T08:00:00Z',
      isActive: true
    },
    {
      id: 4,
      roomNumber: '201',
      floorId: 2,
      typeId: 2,
      status: 'VACANT',
      maxOccupancy: 2,
      telephone: '1201',
      createdAt: '2026-01-10T10:23:00Z',
      updatedAt: '2026-05-18T09:00:00Z',
      isActive: true
    },
    {
      id: 5,
      roomNumber: 'G01',
      floorId: 4,
      typeId: 4,
      status: 'VACANT',
      maxOccupancy: 2,
      telephone: '2001',
      createdAt: '2026-02-15T09:30:00Z',
      updatedAt: '2026-05-18T10:00:00Z',
      isActive: true
    }
  ]);

  // Read-only signals for outside access
  public readonly hotels = this._hotels.asReadonly();
  public readonly floors = this._floors.asReadonly();
  public readonly roomTypes = this._roomTypes.asReadonly();
  public readonly rooms = this._rooms.asReadonly();

  // Helper map getters
  public readonly hotelsMap = computed(() => {
    return new Map(this.hotels().map(h => [h.id, h]));
  });

  public readonly floorsMap = computed(() => {
    return new Map(this.floors().map(f => [f.id, f]));
  });

  public readonly roomTypesMap = computed(() => {
    return new Map(this.roomTypes().map(rt => [rt.id, rt]));
  });

  // --- CRUD Operations for Hotels ---
  saveHotel(hotel: Partial<Hotel>): Hotel {
    const nowStr = new Date().toISOString();
    let saved: Hotel;
    if (hotel.id) {
      this._hotels.update(list => list.map(item => {
        if (item.id === hotel.id) {
          saved = {
            ...item,
            ...hotel,
            updatedAt: nowStr
          } as Hotel;
          return saved;
        }
        return item;
      }));
    } else {
      const newId = this._hotels().reduce((max, h) => h.id > max ? h.id : max, 0) + 1;
      saved = {
        ...hotel,
        id: newId,
        createdAt: nowStr,
        updatedAt: nowStr,
        isActive: hotel.isActive !== undefined ? hotel.isActive : true
      } as Hotel;
      this._hotels.update(list => [saved, ...list]);
    }
    return saved!;
  }

  deleteHotel(id: number) {
    this._hotels.update(list => list.filter(item => item.id !== id));
  }

  // --- CRUD Operations for Floors ---
  saveFloor(floor: Partial<Floor>): Floor {
    const nowStr = new Date().toISOString();
    let saved: Floor;
    if (floor.id) {
      this._floors.update(list => list.map(item => {
        if (item.id === floor.id) {
          saved = {
            ...item,
            ...floor,
            updatedAt: nowStr
          } as Floor;
          return saved;
        }
        return item;
      }));
    } else {
      const newId = this._floors().reduce((max, f) => f.id > max ? f.id : max, 0) + 1;
      saved = {
        ...floor,
        id: newId,
        createdAt: nowStr,
        updatedAt: nowStr,
        isActive: floor.isActive !== undefined ? floor.isActive : true
      } as Floor;
      this._floors.update(list => [saved, ...list]);
    }
    return saved!;
  }

  deleteFloor(id: number) {
    this._floors.update(list => list.filter(item => item.id !== id));
  }

  // --- CRUD Operations for RoomTypes ---
  saveRoomType(roomType: Partial<RoomType>): RoomType {
    const nowStr = new Date().toISOString();
    let saved: RoomType;
    if (roomType.id) {
      this._roomTypes.update(list => list.map(item => {
        if (item.id === roomType.id) {
          saved = {
            ...item,
            ...roomType,
            updatedAt: nowStr
          } as RoomType;
          return saved;
        }
        return item;
      }));
    } else {
      const newId = this._roomTypes().reduce((max, rt) => rt.id > max ? rt.id : max, 0) + 1;
      saved = {
        ...roomType,
        id: newId,
        createdAt: nowStr,
        updatedAt: nowStr,
        isActive: roomType.isActive !== undefined ? roomType.isActive : true
      } as RoomType;
      this._roomTypes.update(list => [saved, ...list]);
    }
    return saved!;
  }

  deleteRoomType(id: number) {
    this._roomTypes.update(list => list.filter(item => item.id !== id));
  }

  // --- CRUD Operations for Rooms ---
  saveRoom(room: Partial<Room>): Room {
    const nowStr = new Date().toISOString();
    let saved: Room;
    if (room.id) {
      this._rooms.update(list => list.map(item => {
        if (item.id === room.id) {
          saved = {
            ...item,
            ...room,
            updatedAt: nowStr
          } as Room;
          return saved;
        }
        return item;
      }));
    } else {
      const newId = this._rooms().reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
      saved = {
        ...room,
        id: newId,
        createdAt: nowStr,
        updatedAt: nowStr,
        isActive: room.isActive !== undefined ? room.isActive : true
      } as Room;
      this._rooms.update(list => [saved, ...list]);
    }
    return saved!;
  }

  deleteRoom(id: number) {
    this._rooms.update(list => list.filter(item => item.id !== id));
  }
}
