import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StandardResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface FolioPostingRequest {
  folioId: number;
  source: string;
  amount: number;
  roomId?: number;
  taxType?: string;
  description?: string;
  paidAmount?: number;
}

export interface FolioPaymentRequest {
  folioId: number;
  mode: string;
  amount: number;
  referenceNumber?: string;
  notes?: string;
}

export interface LedgerEntryDTO {
  date: string;
  source: string;
  description: string;
  debit?: number;
  tax?: number;
  paid?: number;
  credit?: number;
  grossAmount?: number | null;
  taxAmount?: number | null;
}

export interface FolioLedgerDTO {
  folioId: number;
  folioNumber: string;
  reservationNumber: string;
  guestName: string;
  roomNumber: string;
  totalCharges: number;
  totalPayments: number;
  taxAmount: number;
  balance: number;
  status: string;
  entries: LedgerEntryDTO[];
}

export interface InvoiceDTO {
  id: number;
  invoiceNumber: string;
  folioNumber: string;
  roomNumber: string;
  guestName: string;
  amount: number;
  status: string;
  date: string;
}

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private apiUrl = '/api/hmsService/v1/billing';

  constructor(private http: HttpClient) {}

  getActiveFolios(): Observable<StandardResponse<FolioLedgerDTO[]>> {
    return this.http.get<StandardResponse<FolioLedgerDTO[]>>(`${this.apiUrl}/folios/getActiveFolios`);
  }

  getLedger(folioId: number): Observable<StandardResponse<FolioLedgerDTO>> {
    return this.http.get<StandardResponse<FolioLedgerDTO>>(`${this.apiUrl}/folios/getLedgerByFolioId/${folioId}`);
  }

  postCharge(request: FolioPostingRequest): Observable<StandardResponse<void>> {
    return this.http.post<StandardResponse<void>>(`${this.apiUrl}/folios/postCharge`, request);
  }

  collectPayment(request: FolioPaymentRequest): Observable<StandardResponse<void>> {
    return this.http.post<StandardResponse<void>>(`${this.apiUrl}/folios/collectFolioPayment`, request);
  }

  generateInvoice(folioId: number): Observable<StandardResponse<void>> {
    return this.http.post<StandardResponse<void>>(`${this.apiUrl}/folios/generateInvoice/${folioId}`, {});
  }

  getAllInvoices(): Observable<StandardResponse<InvoiceDTO[]>> {
    return this.http.get<StandardResponse<InvoiceDTO[]>>(`${this.apiUrl}/invoices/getAllInvoices`);
  }

  getInvoiceDocumentDetails(invoiceId: number): Observable<StandardResponse<InvoiceDocumentDetailsDTO>> {
    return this.http.get<StandardResponse<InvoiceDocumentDetailsDTO>>(`${this.apiUrl}/invoices/getInvoiceDocumentDatails/${invoiceId}`);
  }
}

export interface HotelInfoDTO {
  name: string;
  address: string;
  gstin: string;
  pan: string;
  email: string;
  tel: string;
}

export interface BillingToDTO {
  guestName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postCode: string;
  placeOfSupply: string;
  organisationName: string | null;
  gstNumber: string | null;
}

export interface StayRecordDTO {
  roomNumber: string;
  roomTypeName: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  numberOfNights: number;
  numberOfAdults: number;
  numberOfChildren: number;
}

export interface InvoiceLineItemDTO {
  srNo: number;
  date: string;
  sacCode: string;
  serviceTitle: string;
  serviceDescription: string;
  baseValue: number;
  taxAmount: number;
  totalAmount: number;
}

export interface GstBreakdownDTO {
  sacCode: string;
  category: string;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalTax: number;
}

export interface InvoiceDocumentDetailsDTO {
  invoiceNumber: string;
  invoiceDate: string;
  folioNumber: string;
  invoiceStatus: string;
  hotelInfo: HotelInfoDTO;
  billingTo: BillingToDTO;
  stayRecord: StayRecordDTO;
  lineItems: InvoiceLineItemDTO[];
  gstBreakdown: GstBreakdownDTO[];
  netTaxableBase: number;
  cgstSubtotal: number;
  sgstSubtotal: number;
  totalTax: number;
  grandTotal: number;
  paymentsReceived: number;
  balanceDue: number;
}
