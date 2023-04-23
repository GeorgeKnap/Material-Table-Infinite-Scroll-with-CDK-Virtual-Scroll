import { DataSource } from '@angular/cdk/table';
import { BehaviorSubject, map, Observable, of, Subject, tap } from 'rxjs';

export const PAGE_SIZE = 50;

export type InfiniteDatasource<T> = DataSource<T> & {
  /**
   * @param page - number of page to load
   * @returns -1 if not the end of the list or the total number of rows
   */
  loadData: (page: number) => Observable<number>;
};

export interface InifiniteDatasourceSevice<T> {
  fetchData(page: number, itemsPerPage: number): Observable<T>;
}

export class MyDataSource<T>
  extends DataSource<T>
  implements InfiniteDatasource<T>
{
  private readonly _dataStream = new BehaviorSubject<T[]>([]);

  constructor(private service: InifiniteDatasourceSevice<T[]>) {
    super();
  }

  connect(): Observable<T[]> {
    return this._dataStream;
  }

  disconnect(): void {
    this._dataStream.complete();
  }

  loadData(page: number): Observable<number> {
    console.log('attempting to fetch page', page);

    return this.service.fetchData(page, PAGE_SIZE).pipe(
      tap((data) =>
        this._dataStream.next([...this._dataStream.value, ...data])
      ),
      map((data) => {
        return data.length < PAGE_SIZE
          ? data.length + (page - 1) * PAGE_SIZE
          : -1;
      })
    );
  }
}
