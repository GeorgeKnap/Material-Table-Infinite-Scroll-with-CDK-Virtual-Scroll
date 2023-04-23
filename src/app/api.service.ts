import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { InifiniteDatasourceSevice } from './datasource';

@Injectable({
  providedIn: 'root',
})
export class ApiService
  implements InifiniteDatasourceSevice<{ index: number }[]>
{
  maxRow = 134;

  fetchData(page: number, itemsPerPage: number) {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, this.maxRow + 1);

    if (startIndex > this.maxRow) {
      return of([]);
    }

    const objectsArray = [];
    for (let index = startIndex; index < endIndex; index++) {
      objectsArray.push({ index });
    }

    console.log(objectsArray);
    return of(objectsArray);
  }
}
