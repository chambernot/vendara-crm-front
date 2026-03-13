import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Tag {
  id: string;
  code: string;
  label: string;
  color?: string;
  active?: boolean;
}

export interface CreateTagDto {
  code: string;
  label: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class TagService {
  private apiBaseUrl = environment.apiBaseUrl || '/api';
  private apiUrl = `${this.apiBaseUrl}/Tags`;

  constructor(private http: HttpClient) {}

  list(workspaceId: string): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.apiUrl}?workspaceId=${workspaceId}`);
  }

  create(dto: CreateTagDto): Observable<Tag> {
    return this.http.post<Tag>(this.apiUrl, dto);
  }

  addToClient(clientId: string, tagId: string): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/Clients/${clientId}/tags`, { tagId });
  }

  removeFromClient(clientId: string, tagId: string): Observable<any> {
    return this.http.delete(`${this.apiBaseUrl}/Clients/${clientId}/tags/${tagId}`);
  }
}
