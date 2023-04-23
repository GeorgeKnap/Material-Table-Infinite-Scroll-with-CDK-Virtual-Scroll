import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { MatTableModule } from '@angular/material/table';
import { CdkTableScrollContainerModule } from '@angular/cdk-experimental/table-scroll-container';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { VirtualScrollDirective } from './virtual-scroll/virtual-scroll.directive';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    MatTableModule,
    CdkTableScrollContainerModule,
    ScrollingModule,
    VirtualScrollDirective,
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
