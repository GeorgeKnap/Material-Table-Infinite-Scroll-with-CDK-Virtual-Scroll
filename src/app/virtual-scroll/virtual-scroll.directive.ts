import { VIRTUAL_SCROLL_STRATEGY } from '@angular/cdk/scrolling';
import { CanStick, CdkTable, DataSource } from '@angular/cdk/table';
import {
  AfterContentInit,
  ContentChild,
  Directive,
  forwardRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
} from '@angular/core';
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  from,
  map,
  Subject,
  switchMap,
} from 'rxjs';
import { delayWhen, startWith, take, takeUntil, tap } from 'rxjs/operators';
import { InfiniteDatasource } from '../datasource';
import { FixedSizeTableVirtualScrollStrategy } from './virtual-scroll.strategy';

export function _tableVirtualScrollDirectiveStrategyFactory(
  tableDir: VirtualScrollDirective
) {
  return tableDir.scrollStrategy;
}

function combineSelectors(...pairs: string[][]): string {
  return pairs
    .map((selectors) => `${selectors.join(' ')}, ${selectors.join('')}`)
    .join(', ');
}

const stickyHeaderSelector = combineSelectors(
  ['.mat-mdc-header-row', '.mat-mdc-table-sticky'],
  ['.mat-header-row', '.mat-table-sticky'],
  ['.cdk-header-row', '.cdk-table-sticky']
);

const stickyFooterSelector = combineSelectors(
  ['.mat-mdc-footer-row', '.mat-mdc-table-sticky'],
  ['.mat-footer-row', '.mat-table-sticky'],
  ['.cdk-footer-row', '.cdk-table-sticky']
);

function implementsInfiniteDatasource<T>(
  dataSource: InfiniteDatasource<T>
): dataSource is InfiniteDatasource<T> {
  return typeof dataSource.loadData === 'function';
}

const defaults = {
  rowHeight: 52,
  headerHeight: 56,
  headerEnabled: true,
  footerHeight: 48,
  footerEnabled: false,
  bufferMultiplier: 0.7,
  pageSize: 10,
};

@Directive({
  standalone: true,
  selector: 'cdk-virtual-scroll-viewport[sdsPageSize]',
  providers: [
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: _tableVirtualScrollDirectiveStrategyFactory,
      deps: [forwardRef(() => VirtualScrollDirective)],
    },
  ],
})
export class VirtualScrollDirective<T = unknown>
  implements OnChanges, AfterContentInit, OnDestroy
{
  private destroyed$ = new Subject<void>();

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('sdsPageSize')
  pageSize: string | number = defaults.pageSize;

  @Input()
  rowHeight: string | number = defaults.rowHeight;

  @Input()
  headerEnabled: boolean = defaults.headerEnabled;

  @Input()
  headerHeight: string | number = defaults.headerHeight;

  @Input()
  footerEnabled: boolean = defaults.footerEnabled;

  @Input()
  footerHeight: string | number = defaults.footerHeight;

  @Input()
  bufferMultiplier: string | number = defaults.bufferMultiplier;

  @ContentChild(CdkTable, { static: false })
  table: CdkTable<T>;

  scrollStrategy = new FixedSizeTableVirtualScrollStrategy();

  dataSourceChanges$ = new Subject<void>();

  private stickyPositions: Map<HTMLElement, number>;
  private resetStickyPositions = new Subject<void>();
  private stickyEnabled = {
    header: false,
    footer: false,
  };

  constructor(private zone: NgZone) {}

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.dataSourceChanges$.complete();
  }

  ngAfterContentInit() {
    const switchDataSourceOrigin = this.table['_switchDataSource'];
    this.table['_switchDataSource'] = (dataSource: any) => {
      switchDataSourceOrigin.call(this.table, dataSource);
      this.connectDataSource(dataSource);
    };

    const updateStickyColumnStylesOrigin = this.table.updateStickyColumnStyles;
    this.table.updateStickyColumnStyles = () => {
      const stickyColumnStylesNeedReset =
        this.table['_stickyColumnStylesNeedReset'];
      updateStickyColumnStylesOrigin.call(this.table);
      if (stickyColumnStylesNeedReset) {
        this.resetStickyPositions.next();
      }
    };

    this.connectDataSource(this.table.dataSource as InfiniteDatasource<T>);

    combineLatest([
      this.scrollStrategy.stickyChange,
      this.resetStickyPositions.pipe(
        startWith(void 0),
        delayWhen(() => this.getScheduleObservable()),
        tap(() => {
          this.stickyPositions = null;
        })
      ),
    ])
      .pipe(takeUntil(this.destroyed$))
      .subscribe(([stickyOffset]) => {
        if (!this.stickyPositions) {
          this.initStickyPositions();
        }
        if (this.stickyEnabled.header) {
          this.setStickyHeader(stickyOffset);
        }
        if (this.stickyEnabled.footer) {
          this.setStickyFooter(stickyOffset);
        }
      });
  }

  connectDataSource(dataSource: InfiniteDatasource<T>) {
    this.dataSourceChanges$.next();
    if (
      !(dataSource instanceof DataSource) &&
      !implementsInfiniteDatasource(dataSource)
    ) {
      throw new Error(
        '[sdsItemSize] requires InfiniteDataSource be set as [dataSource] of [mat-table]'
      );
    }

    this.scrollStrategy.renderedRangeStream
      .pipe(
        filter(({ end }) => this.scrollStrategy.dataLength > end),
        map(({ end }) => this.getPageForIndex(end)),
        distinctUntilChanged(),
        switchMap((page) => dataSource.loadData(page)),
        filter((response) => response !== -1),
        distinctUntilChanged()
      )
      .subscribe((totalRows) => {
        console.log(`got total rows!: ${totalRows}`);
        this.scrollStrategy.dataLength = totalRows;
      });
  }

  ngOnChanges() {
    const config = {
      rowHeight: +this.rowHeight || defaults.rowHeight,
      headerHeight: this.headerEnabled
        ? +this.headerHeight || defaults.headerHeight
        : 0,
      footerHeight: this.footerEnabled
        ? +this.footerHeight || defaults.footerHeight
        : 0,
      bufferMultiplier: +this.bufferMultiplier || defaults.bufferMultiplier,
    };
    this.scrollStrategy.setConfig(config);
  }

  private getPageForIndex(index: number): number {
    const floor = Math.floor(index / +this.pageSize);
    return floor > 0 ? floor : 1;
  }

  private setStickyEnabled(): boolean {
    if (!this.scrollStrategy.viewport) {
      this.stickyEnabled = {
        header: false,
        footer: false,
      };
      return;
    }

    const isEnabled = (rowDefs: CanStick[]) =>
      rowDefs
        .map((def) => def.sticky)
        .reduce((prevState, state) => prevState && state, true);

    this.stickyEnabled = {
      header: isEnabled(this.table['_headerRowDefs']),
      footer: isEnabled(this.table['_footerRowDefs']),
    };
  }

  private setStickyHeader(offset: number) {
    this.scrollStrategy.viewport.elementRef.nativeElement
      .querySelectorAll(stickyHeaderSelector)
      .forEach((el: HTMLElement) => {
        const parent = el.parentElement;
        let baseOffset = 0;
        if (this.stickyPositions.has(parent)) {
          baseOffset = this.stickyPositions.get(parent);
        }
        el.style.top = `${baseOffset - offset}px`;
      });
  }

  private setStickyFooter(offset: number) {
    this.scrollStrategy.viewport.elementRef.nativeElement
      .querySelectorAll(stickyFooterSelector)
      .forEach((el: HTMLElement) => {
        const parent = el.parentElement;
        let baseOffset = 0;
        if (this.stickyPositions.has(parent)) {
          baseOffset = this.stickyPositions.get(parent);
        }
        el.style.bottom = `${-baseOffset + offset}px`;
      });
  }

  private initStickyPositions() {
    this.stickyPositions = new Map<HTMLElement, number>();

    this.setStickyEnabled();

    if (this.stickyEnabled.header) {
      this.scrollStrategy.viewport.elementRef.nativeElement
        .querySelectorAll(stickyHeaderSelector)
        .forEach((el) => {
          const parent = el.parentElement;
          if (!this.stickyPositions.has(parent)) {
            this.stickyPositions.set(parent, parent.offsetTop);
          }
        });
    }

    if (this.stickyEnabled.footer) {
      this.scrollStrategy.viewport.elementRef.nativeElement
        .querySelectorAll(stickyFooterSelector)
        .forEach((el) => {
          const parent = el.parentElement;
          if (!this.stickyPositions.has(parent)) {
            this.stickyPositions.set(parent, -parent.offsetTop);
          }
        });
    }
  }

  private getScheduleObservable() {
    // Use onStable when in the context of an ongoing change detection cycle so that we
    // do not accidentally trigger additional cycles.
    return this.zone.isStable
      ? from(Promise.resolve(undefined))
      : this.zone.onStable.pipe(take(1));
  }
}
