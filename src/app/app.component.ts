import { Component, inject } from '@angular/core';
import { ApiService } from './api.service';
import { MyDataSource, PAGE_SIZE } from './datasource';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  service = inject(ApiService);
  pageSize = PAGE_SIZE;
  ds = new MyDataSource(this.service);

  displayedColumns: string[] = ['index'];
}
